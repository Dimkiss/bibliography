from __future__ import annotations

import re
from datetime import date

from app.schemas.search_plan import SearchPlanFilters, SearchPlanResponse
from app.services.llm_planner import (
    LlmPlanningError,
    build_llm_search_plan,
    is_llm_planner_enabled,
)


DATABASE_PATTERNS: tuple[tuple[str, str], ...] = (
    ("scopus", "scopus"),
    ("скопус", "scopus"),
    ("web of science", "wos"),
    ("wos", "wos"),
    ("вос", "wos"),
    ("ринц", "rinc"),
    ("rinc", "rinc"),
    ("вак", "vak"),
    ("vak", "vak"),
    ("белый список", "white_list"),
)

STOP_WORDS = {
    "найди",
    "найти",
    "покажи",
    "показать",
    "подбери",
    "подобрать",
    "ищи",
    "искать",
    "статьи",
    "статья",
    "публикации",
    "публикация",
    "работы",
    "работа",
    "материалы",
    "материал",
    "про",
    "по",
    "об",
    "о",
    "на",
    "за",
    "в",
    "во",
    "из",
    "с",
    "со",
    "только",
    "среди",
    "где",
    "которые",
    "которых",
}


REFINE_REQUEST_PATTERNS: tuple[str, ...] = (
    r"\bсреди\s+(?:результатов|найденн(?:ых|ого|ыми)|них)\b",
    r"\bиз\s+найденн(?:ых|ого|ыми)\b",
    r"\bв\s+найденн(?:ых|ом|ыми)\b",
    r"\bуточни\s+(?:по|среди|в)\b",
)


NON_SEARCH_REQUEST_PATTERNS: tuple[str, ...] = (
    r"^\s*(?:привет|здравствуй|здравствуйте|добрый\s+день|спасибо|ок|понял[аи]?)\s*[.!?]*\s*$",
    r"\bкто\s+ты\b",
    r"\bчто\s+ты\s+умеешь\b",
    r"\b(?:какая|какую|что\s+за)\s+ты\s+модель\b",
    r"\b(?:какая|какую|что\s+за)\s+(?:у\s+тебя\s+)?модель\b",
    r"\bна\s+какой\s+модели\s+ты\b",
    r"\bкак(?:ая|ой)?\s+модель\s+(?:используется|подключена)\b",
)


def _is_refine_request(message: str) -> bool:
    return any(
        re.search(pattern, message, flags=re.IGNORECASE)
        for pattern in REFINE_REQUEST_PATTERNS
    )


def _is_non_search_request(message: str) -> bool:
    return any(
        re.search(pattern, message, flags=re.IGNORECASE)
        for pattern in NON_SEARCH_REQUEST_PATTERNS
    )


def _build_unsupported_refine_plan() -> SearchPlanResponse:
    return SearchPlanResponse(
        intent="clarify",
        explanation=(
            "Уточнение среди уже найденных публикаций пока не подключено. "
            "Текущая выдача не изменена."
        ),
        filters=SearchPlanFilters(),
    )


def _build_non_search_plan() -> SearchPlanResponse:
    return SearchPlanResponse(
        intent="clarify",
        explanation=(
            "Я обрабатываю только запросы на поиск публикаций. "
            "Текущая выдача не изменена."
        ),
        filters=SearchPlanFilters(),
    )


def _dedupe(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()

    for value in values:
        normalized = value.strip().lower()
        if not normalized or normalized in seen:
            continue

        seen.add(normalized)
        result.append(value)

    return result


def _extract_years(message: str, current_year: int) -> tuple[int | None, int | None, str]:
    text = message
    year_from: int | None = None
    year_to: int | None = None

    last_years_match = re.search(
        r"(?:за\s+)?последн(?:ие|их|ий)\s+(\d{1,2})\s+лет",
        text,
        flags=re.IGNORECASE,
    )
    if last_years_match:
        years_count = int(last_years_match.group(1))
        year_from = max(0, current_year - years_count)
        year_to = current_year
        text = text.replace(last_years_match.group(0), " ")

    range_match = re.search(
        r"(?:с|от)\s+(19\d{2}|20\d{2})\s+(?:по|до|-)\s+(19\d{2}|20\d{2})",
        text,
        flags=re.IGNORECASE,
    )
    if range_match:
        first_year = int(range_match.group(1))
        second_year = int(range_match.group(2))
        year_from = min(first_year, second_year)
        year_to = max(first_year, second_year)
        text = text.replace(range_match.group(0), " ")

    explicit_years = [int(value) for value in re.findall(r"\b(19\d{2}|20\d{2})\b", text)]
    if explicit_years and year_from is None and year_to is None:
        year_from = min(explicit_years)
        year_to = max(explicit_years)
        for year in explicit_years:
            text = re.sub(rf"\b{year}\b", " ", text)

    return year_from, year_to, text


def _extract_databases(message: str) -> tuple[list[str], str]:
    text = message
    databases: list[str] = []

    for pattern, value in DATABASE_PATTERNS:
        if re.search(rf"\b{re.escape(pattern)}\b", text, flags=re.IGNORECASE):
            databases.append(value)
            text = re.sub(
                rf"\b{re.escape(pattern)}\b",
                " ",
                text,
                flags=re.IGNORECASE,
            )

    return _dedupe(databases), text


def _extract_original_translation_mode(message: str) -> tuple[str, str]:
    text = message

    translation_patterns = (
        r"только\s+переводы",
        r"переводн(?:ые|ая|ую|ых)",
    )
    for pattern in translation_patterns:
        if re.search(pattern, text, flags=re.IGNORECASE):
            text = re.sub(pattern, " ", text, flags=re.IGNORECASE)
            return "translation_only", text

    original_patterns = (
        r"только\s+оригиналы",
        r"оригинальн(?:ые|ая|ую|ых)",
    )
    for pattern in original_patterns:
        if re.search(pattern, text, flags=re.IGNORECASE):
            text = re.sub(pattern, " ", text, flags=re.IGNORECASE)
            return "original_only", text

    return "all", text


def _build_text_query(message: str) -> str | None:
    normalized = re.sub(r"[^\w\s-]+", " ", message, flags=re.UNICODE)
    words = [
        word.strip()
        for word in normalized.split()
        if word.strip() and word.strip().lower() not in STOP_WORDS
    ]

    if not words:
        return None

    return " ".join(_dedupe(words))


def _build_explanation(filters: SearchPlanFilters) -> str:
    parts: list[str] = []

    if filters.text_query:
        parts.append(f"текстовый запрос: {filters.text_query}")

    if filters.year_from is not None and filters.year_to is not None:
        if filters.year_from == filters.year_to:
            parts.append(f"год: {filters.year_from}")
        else:
            parts.append(f"период: {filters.year_from}-{filters.year_to}")
    elif filters.year_from is not None:
        parts.append(f"с {filters.year_from} года")
    elif filters.year_to is not None:
        parts.append(f"до {filters.year_to} года")

    if filters.databases:
        parts.append("базы: " + ", ".join(filters.databases))

    if filters.original_translation_mode == "original_only":
        parts.append("только оригиналы")
    elif filters.original_translation_mode == "translation_only":
        parts.append("только переводы")

    if not parts:
        return "Не удалось выделить точные параметры, использую исходную фразу как текстовый запрос."

    return "Сформирован план поиска: " + "; ".join(parts) + "."


def build_rule_based_search_plan(message: str) -> SearchPlanResponse:
    current_year = date.today().year
    cleaned_message = message.strip()

    year_from, year_to, cleaned_message = _extract_years(
        cleaned_message,
        current_year,
    )
    databases, cleaned_message = _extract_databases(cleaned_message)
    original_translation_mode, cleaned_message = _extract_original_translation_mode(
        cleaned_message,
    )
    text_query = _build_text_query(cleaned_message) or _build_text_query(message)

    filters = SearchPlanFilters(
        text_query=text_query,
        year_from=year_from,
        year_to=year_to,
        databases=databases,
        original_translation_mode=original_translation_mode,
    )

    return SearchPlanResponse(
        explanation=_build_explanation(filters),
        filters=filters,
    )


def build_search_plan(message: str) -> SearchPlanResponse:
    if _is_non_search_request(message):
        return _build_non_search_plan()

    if _is_refine_request(message):
        return _build_unsupported_refine_plan()

    if is_llm_planner_enabled():
        try:
            return build_llm_search_plan(message)
        except LlmPlanningError:
            pass

    return build_rule_based_search_plan(message)
