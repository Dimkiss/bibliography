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
    "есть",
    "содержит",
    "содержат",
    "содержится",
    "упоминается",
    "упоминаются",
    "встречается",
    "встречаются",
}


SEARCH_INTENT_PATTERNS: tuple[str, ...] = (
    r"\b(?:найди|найти|покажи|показать|подбери|подобрать|ищи|искать)\b",
    r"\b(?:стать[яьи]|статей|публикаци[яиюй]|публикаций|работ[ауы]|работ)\b",
    r"\b(?:автор|автора|авторы|названи[еяю]|журнал|издани[ея]|doi|ключев(?:ые|ым|ых)\s+слов)\b",
    r"\b(?:scopus|web\s+of\s+science|wos|ринц|вак|бел(?:ый|ом|ого|ому|ым)\s+спис)\b",
    r"\b(?:19\d{2}|20\d{2})\b",
    r"\bпоследн(?:ие|их|ий)\s+\d{1,2}\s+лет\b",
)


QUESTION_START_PATTERN = re.compile(
    r"^\s*(?:кто|что|какой|какая|какое|какие|сколько|когда|где|почему|зачем|как)\b",
    flags=re.IGNORECASE,
)


NON_PUBLICATION_TOPIC_PATTERNS: tuple[str, ...] = (
    r"\b(?:погода|температура|дождь|снег|ветер)\b",
    r"\b(?:время|час|дата|день\s+недели|сегодня|завтра|вчера)\b",
    r"\b(?:курс\s+валют|доллар|евро|биткоин)\b",
    r"\b(?:анекдот|шутк[ауи]|рецепт|переведи|переводчик)\b",
    r"\b(?:qwen|ollama|chatgpt|gpt|llm|нейросет[ьи]|модель\s+ии)\b",
)


REFINE_REQUEST_PATTERNS: tuple[str, ...] = (
    r"\bсреди\s+(?:результатов|найденн(?:ых|ого|ыми)|них)\b",
    r"\bсреди\s+публикаций\b",
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
    return _classify_request(message) == "non_search"


def _has_search_intent_marker(message: str) -> bool:
    return any(
        re.search(pattern, message, flags=re.IGNORECASE)
        for pattern in SEARCH_INTENT_PATTERNS
    )


def _has_non_publication_topic_marker(message: str) -> bool:
    return any(
        re.search(pattern, message, flags=re.IGNORECASE)
        for pattern in NON_PUBLICATION_TOPIC_PATTERNS
    )


def _classify_request(message: str) -> str:
    text = message.strip()

    if not text:
        return "non_search"

    if any(
        re.search(pattern, text, flags=re.IGNORECASE)
        for pattern in NON_SEARCH_REQUEST_PATTERNS
    ):
        return "non_search"

    if _has_search_intent_marker(text):
        return "search"

    if _has_non_publication_topic_marker(text):
        return "non_search"

    if QUESTION_START_PATTERN.search(text) or text.endswith("?"):
        return "non_search"

    terms = _parse_search_terms(text)
    if len(terms) >= 2:
        return "search"

    if len(terms) == 1 and len(terms[0]) >= 4:
        return "search"

    return "non_search"


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


def _has_filter_criteria(filters: SearchPlanFilters | None) -> bool:
    if filters is None:
        return False

    return bool(
        (filters.text_query and filters.text_query.strip())
        or (filters.refine_text_query and filters.refine_text_query.strip())
        or (filters.pdf_text_query and filters.pdf_text_query.strip())
        or (filters.title and filters.title.strip())
        or (filters.author and filters.author.strip())
        or (filters.journal and filters.journal.strip())
        or any(value.strip() for value in filters.keyword)
        or any(value.strip() for value in filters.publication_types)
        or any(value.strip() for value in filters.databases)
        or filters.article_ids
        or filters.year_from is not None
        or filters.year_to is not None
        or filters.original_translation_mode != "all"
    )


def _parse_search_terms(message: str) -> list[str]:
    normalized = re.sub(r"[^\w\s-]+", " ", message, flags=re.UNICODE)
    return [
        word.strip()
        for word in normalized.split()
        if word.strip() and word.strip().lower() not in STOP_WORDS
    ]


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
    words = _parse_search_terms(message)

    if not words:
        return None

    return " ".join(_dedupe(words))


PDF_SEARCH_PATTERNS: tuple[str, ...] = (
    r"\bpdf\b",
    r"\bпдф\b",
    r"\bполнотекстов",
    r"\bполном\s+тексте\b",
    r"\bв\s+тексте\s+(?:статьи|публикации|pdf|пдф)\b",
    r"\bвнутри\s+(?:статьи|публикации|pdf|пдф)\b",
)


MIXED_PDF_SEARCH_PATTERN = re.compile(
    r"(?P<metadata>.*?)"
    r"(?:,|\s+)?"
    r"(?:(?:\bгде\b|\bи\b)\s+)?"
    r"(?:"
    r"в\s+(?:pdf|пдф|полном\s+тексте|тексте(?:\s+(?:статьи|публикации))?)"
    r"|внутри\s+(?:pdf|пдф|статьи|публикации)"
    r"|pdf"
    r"|пдф"
    r")"
    r"\s*(?:есть|содержит|содержат|содержится|упоминается|упоминаются|"
    r"встречается|встречаются|найди|искать|по)?\s+"
    r"(?P<pdf>.+)",
    flags=re.IGNORECASE,
)


def _is_pdf_search_request(message: str) -> bool:
    return any(
        re.search(pattern, message, flags=re.IGNORECASE)
        for pattern in PDF_SEARCH_PATTERNS
    )


def _clean_pdf_search_message(message: str) -> str:
    text = message

    for pattern in PDF_SEARCH_PATTERNS:
        text = re.sub(pattern, " ", text, flags=re.IGNORECASE)

    return re.sub(r"\s+", " ", text).strip()


def _extract_pdf_text_query(message: str) -> tuple[str, str | None]:
    match = MIXED_PDF_SEARCH_PATTERN.search(message)

    if not match:
        if not _is_pdf_search_request(message):
            return message, None

        return "", _build_text_query(_clean_pdf_search_message(message))

    metadata_part = match.group("metadata").strip(" ,.;:-")
    if not _build_text_query(metadata_part):
        metadata_part = ""
    pdf_part = match.group("pdf").strip(" ,.;:-")

    return metadata_part, _build_text_query(pdf_part)


def _clean_refine_message(message: str) -> str:
    text = message

    for pattern in REFINE_REQUEST_PATTERNS:
        text = re.sub(pattern, " ", text, flags=re.IGNORECASE)

    return re.sub(r"\s+", " ", text).strip()


def _merge_optional_text(base_value: str | None, next_value: str | None) -> str | None:
    values = [base_value or "", next_value or ""]
    merged = _dedupe(
        [
            word
            for value in values
            for word in _parse_search_terms(value)
        ]
    )

    return " ".join(merged) if merged else None


def _merge_refine_plan(
    base_filters: SearchPlanFilters,
    refine_plan: SearchPlanResponse,
) -> SearchPlanResponse:
    next_filters = refine_plan.filters
    refine_text_query = _merge_optional_text(
        base_filters.refine_text_query,
        next_filters.text_query,
    )

    merged_filters = SearchPlanFilters(
        text_query=base_filters.text_query,
        refine_text_query=refine_text_query,
        pdf_text_query=base_filters.pdf_text_query,
        title=next_filters.title or base_filters.title,
        author=next_filters.author or base_filters.author,
        journal=next_filters.journal or base_filters.journal,
        keyword=_dedupe([*base_filters.keyword, *next_filters.keyword]),
        year_from=(
            max(base_filters.year_from, next_filters.year_from)
            if base_filters.year_from is not None and next_filters.year_from is not None
            else next_filters.year_from
            if next_filters.year_from is not None
            else base_filters.year_from
        ),
        year_to=(
            min(base_filters.year_to, next_filters.year_to)
            if base_filters.year_to is not None and next_filters.year_to is not None
            else next_filters.year_to
            if next_filters.year_to is not None
            else base_filters.year_to
        ),
        publication_types=_dedupe(
            [*base_filters.publication_types, *next_filters.publication_types]
        ),
        databases=_dedupe([*base_filters.databases, *next_filters.databases]),
        original_translation_mode=(
            next_filters.original_translation_mode
            if next_filters.original_translation_mode != "all"
            else base_filters.original_translation_mode
        ),
    )

    return SearchPlanResponse(
        intent="search",
        explanation=_build_explanation(merged_filters, is_refine=True),
        filters=merged_filters,
        semantic=refine_plan.semantic,
        sort=refine_plan.sort,
    )


def _build_refine_plan_from_message(
    base_filters: SearchPlanFilters,
    message: str,
) -> SearchPlanResponse:
    refine_text_query = _merge_optional_text(
        base_filters.refine_text_query,
        _build_text_query(message),
    )

    if not refine_text_query:
        return _build_non_search_plan()

    merged_filters = SearchPlanFilters(
        text_query=base_filters.text_query,
        refine_text_query=refine_text_query,
        pdf_text_query=base_filters.pdf_text_query,
        title=base_filters.title,
        author=base_filters.author,
        journal=base_filters.journal,
        keyword=[*base_filters.keyword],
        year_from=base_filters.year_from,
        year_to=base_filters.year_to,
        publication_types=[*base_filters.publication_types],
        databases=[*base_filters.databases],
        original_translation_mode=base_filters.original_translation_mode,
    )

    return SearchPlanResponse(
        intent="search",
        explanation=_build_explanation(merged_filters, is_refine=True),
        filters=merged_filters,
    )


def _build_explanation(
    filters: SearchPlanFilters,
    is_refine: bool = False,
) -> str:
    parts: list[str] = []

    if filters.text_query:
        parts.append(f"метаданные: {filters.text_query}")

    if filters.refine_text_query:
        parts.append(f"уточнение: {filters.refine_text_query}")

    if filters.pdf_text_query:
        parts.append(f"PDF-текст: {filters.pdf_text_query}")

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

    prefix = "Уточняю текущую выдачу: " if is_refine else "Сформирован план поиска: "
    return prefix + "; ".join(parts) + "."


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
    if _is_pdf_search_request(cleaned_message):
        metadata_message, pdf_text_query = _extract_pdf_text_query(cleaned_message)
        text_query = _build_text_query(metadata_message)
        pdf_text_query = pdf_text_query or _build_text_query(
            _clean_pdf_search_message(cleaned_message)
        )
    else:
        pdf_text_query = None
        text_query = _build_text_query(cleaned_message) or _build_text_query(message)

    filters = SearchPlanFilters(
        text_query=text_query,
        pdf_text_query=pdf_text_query,
        year_from=year_from,
        year_to=year_to,
        databases=databases,
        original_translation_mode=original_translation_mode,
    )

    return SearchPlanResponse(
        explanation=_build_explanation(filters),
        filters=filters,
    )


def _build_delta_search_plan(message: str) -> SearchPlanResponse:
    if len(_parse_search_terms(message)) == 1:
        return build_rule_based_search_plan(message)

    if is_llm_planner_enabled():
        try:
            return build_llm_search_plan(message)
        except LlmPlanningError:
            pass

    return build_rule_based_search_plan(message)


def build_search_plan(
    message: str,
    current_filters: SearchPlanFilters | None = None,
) -> SearchPlanResponse:
    if _is_non_search_request(message):
        return _build_non_search_plan()

    if _is_refine_request(message):
        if not _has_filter_criteria(current_filters):
            return _build_unsupported_refine_plan()

        refine_message = _clean_refine_message(message)
        if not _parse_search_terms(refine_message):
            return _build_non_search_plan()

        return _build_refine_plan_from_message(current_filters, refine_message)

    if _is_pdf_search_request(message):
        return build_rule_based_search_plan(message)

    return _build_delta_search_plan(message)
