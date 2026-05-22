from __future__ import annotations

import json
import os
import re
from datetime import date
from typing import Any

import httpx
from pydantic import ValidationError

from app.schemas.search_plan import SearchPlanResponse


OLLAMA_GENERATE_PATH = "/api/generate"

DATABASE_MENTION_PATTERNS: tuple[str, ...] = (
    r"\bscopus\b",
    r"\bweb\s+of\s+science\b",
    r"\bwos\b",
    r"\bр(?:и|і)нц\b",
    r"\bвак\b",
    r"\bбел(?:ый|ом|ого|ому|ым)\s+спис",
)


class LlmPlanningError(RuntimeError):
    """Raised when the LLM planner cannot produce a valid SearchPlan."""


def is_llm_planner_enabled() -> bool:
    return os.getenv("AI_LLM_ENABLED", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _get_ollama_base_url() -> str:
    return os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")


def _get_ollama_model() -> str:
    return os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct").strip()


def _strip_code_fence(value: str) -> str:
    text = value.strip()
    fence_match = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, flags=re.DOTALL)

    if fence_match:
        return fence_match.group(1).strip()

    return text


def _extract_json_object(value: str) -> str:
    text = _strip_code_fence(value)

    if text.startswith("{") and text.endswith("}"):
        return text

    start = text.find("{")
    end = text.rfind("}")

    if start < 0 or end <= start:
        raise LlmPlanningError("LLM did not return a JSON object.")

    return text[start : end + 1]


def _build_prompt(message: str) -> str:
    current_year = date.today().year

    return f"""
Ты преобразуешь пользовательский запрос в JSON-план поиска публикаций.
Ты не ищешь статьи, не пишешь SQL, не используешь интернет и не добавляешь факты.
Источник истины - только локальная библиографическая база, поиск выполнит другой сервис.

Верни строго один JSON-объект без markdown и пояснений вне JSON.

Текущий год: {current_year}.

Допустимые значения:
- intent: "search" или "clarify"
- filters.databases: только "wos", "scopus", "white_list", "rinc", "vak"
- filters.original_translation_mode: "all", "original_only", "translation_only"
- semantic.scope: "metadata"
- sort.by: "authors", "title", "journal", "year", "doi", "quartile", "relevance"
- sort.order: "asc", "desc"

Правила:
- Ты отвечаешь только на запросы про поиск, подбор, фильтрацию или уточнение публикаций в локальной библиографической базе.
- Если пользовательский текст не относится к поиску публикаций, верни intent = "clarify", все filters оставь пустыми, semantic.query = null, semantic.scope = "metadata", sort.by = "relevance", sort.order = "desc".
- Для таких сторонних запросов explanation должен быть: "Извините, я отвечаю только на вопросы про поиск публикаций."
- Сторонние запросы: приветствия, благодарности, вопросы о тебе или модели, погода, время, даты, перевод, рецепты, анекдоты, общие знания и любые темы вне поиска публикаций.
- Для сторонних запросов не извлекай поисковые слова и не заполняй filters.text_query.
- Для общего тематического запроса заполняй filters.text_query.
- text_query должен содержать только полезные термины поиска, без слов "найди", "статьи", "публикации".
- filters.refine_text_query всегда оставляй null, уточнение текущей выдачи обрабатывает сервис.
- filters.pdf_text_query заполняй только если пользователь явно просит искать в PDF, полном тексте, тексте статьи или внутри публикации.
- Если пользователь указал период, заполни year_from/year_to.
- "за последние N лет" означает от current_year - N до current_year.
- Заполняй filters.databases только если пользователь явно назвал конкретную базу: Scopus, Web of Science, WoS, РИНЦ, ВАК или белый список.
- Если пользователь не назвал базу данных, filters.databases обязан быть [].
- Не выбирай базы данных самостоятельно и не добавляй "общие" базы по умолчанию.
- Для обычной темы используй filters.text_query, а filters.keyword оставляй [].
- filters.keyword заполняй только если пользователь явно просит искать именно по ключевым словам или перечисляет ключевые слова.
- Не заполняй article_ids, они всегда [].
- semantic.query пока null, semantic.scope всегда "metadata".
- Для тематических запросов ставь sort.by = "relevance", sort.order = "desc".
- Если пользователь явно просит свежие, новые или последние публикации, ставь sort.by = "year", sort.order = "desc".
- Если пользователь просит искать "среди результатов", "среди найденных", "среди них", верни intent = "clarify", filters оставь пустыми и объясни, что уточнение среди найденных пока не подключено.

Форма ответа:
{{
  "intent": "search",
  "explanation": "Коротко по-русски, какие параметры применены.",
  "filters": {{
    "text_query": null,
    "refine_text_query": null,
    "pdf_text_query": null,
    "title": null,
    "author": null,
    "journal": null,
    "keyword": [],
    "year_from": null,
    "year_to": null,
    "publication_types": [],
    "databases": [],
    "original_translation_mode": "all",
    "article_ids": []
  }},
  "semantic": {{
    "query": null,
    "scope": "metadata"
  }},
  "sort": {{
    "by": "relevance",
    "order": "desc"
  }}
}}

Запрос пользователя:
{message}
""".strip()


def _message_mentions_database(message: str) -> bool:
    return any(
        re.search(pattern, message, flags=re.IGNORECASE)
        for pattern in DATABASE_MENTION_PATTERNS
    )


def _normalize_plan(plan: SearchPlanResponse, message: str) -> SearchPlanResponse:
    if not _message_mentions_database(message):
        plan.filters.databases = []

    return plan


def _call_ollama(prompt: str) -> str:
    base_url = _get_ollama_base_url()
    model = _get_ollama_model()

    if not model:
        raise LlmPlanningError("OLLAMA_MODEL is empty.")

    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0,
            "num_predict": 900,
        },
    }

    try:
        with httpx.Client(timeout=90) as client:
            response = client.post(
                f"{base_url}{OLLAMA_GENERATE_PATH}",
                json=payload,
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise LlmPlanningError(f"Ollama request failed: {exc}") from exc

    data = response.json()
    result = data.get("response")

    if not isinstance(result, str) or not result.strip():
        raise LlmPlanningError("Ollama response is empty.")

    return result


def build_llm_search_plan(message: str) -> SearchPlanResponse:
    prompt = _build_prompt(message)
    raw_response = _call_ollama(prompt)
    json_text = _extract_json_object(raw_response)

    try:
        decoded = json.loads(json_text)
        return _normalize_plan(SearchPlanResponse.model_validate(decoded), message)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise LlmPlanningError("LLM returned invalid SearchPlan JSON.") from exc
