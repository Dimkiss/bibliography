from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Mapping

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class ReferenceLabels:
    volume: str
    pages: str
    extent_unit: str
    editor: str


FOREIGN_LABELS = ReferenceLabels(
    volume="- V.",
    pages="- P.",
    extent_unit="p.",
    editor="ed.",
)
RUSSIAN_LABELS = ReferenceLabels(
    volume="- \u0422.",
    pages="- \u0421.",
    extent_unit="\u0441.",
    editor="\u0440\u0435\u0434.",
)

DIRECT_PAGE_COLUMNS = (
    "Pages_F25",
    "Pages",
    "pages",
    "PageRange",
    "page_range",
    "PagesRange",
)

PAGE_RANGE_COLUMN_PAIRS = (
    ("FirstPage", "LastPage"),
    ("first_page", "last_page"),
    ("StartPage", "EndPage"),
    ("start_page", "end_page"),
    ("PageStart", "PageEnd"),
    ("page_start", "page_end"),
    ("PageFrom", "PageTo"),
    ("page_from", "page_to"),
)

VALUE_END_RE = re.compile(r"[.!?]\s*$")
LATIN_RE = re.compile(r"[A-Za-z]")


def build_bibliographic_reference(row: Mapping[str, Any]) -> str:
    labels = FOREIGN_LABELS if _is_foreign_record(row) else RUSSIAN_LABELS

    if _value(row, "work_form_type", "WorkFormType_f") == "B":
        reference = _build_monograph_reference(row, labels)
    else:
        reference = _build_regular_reference(row, labels)

    return _cleanup_reference(reference)


def build_pages_fallback_select_sql(
    db: Session,
    *,
    table_name: str = "journalarticlesattributes",
    alias: str = "jaa",
) -> str:
    columns = _get_table_columns(db, table_name)
    expressions: list[str] = []

    for column in DIRECT_PAGE_COLUMNS:
        if column in columns:
            expressions.append(_null_string_sql(alias, column))

    for start_column, end_column in PAGE_RANGE_COLUMN_PAIRS:
        if start_column not in columns or end_column not in columns:
            continue

        start_expr = _null_string_sql(alias, start_column)
        end_expr = _null_string_sql(alias, end_column)
        expressions.append(
            "NULLIF(TRIM(BOTH '-' FROM CONCAT_WS('-', "
            f"{start_expr}, {end_expr})), '')"
        )

    if not expressions:
        return "NULL"

    return "COALESCE(" + ", ".join(expressions) + ")"


def _build_regular_reference(
    row: Mapping[str, Any],
    labels: ReferenceLabels,
) -> str:
    parts: list[str] = []

    _append_sentence(parts, _value(row, "author_analitic", "Author_Analitic_F1"))
    _append_sentence(parts, _value(row, "title_analitic", "Title_Analitic_F4", "title"))
    _append_sentence(parts, _value(row, "author_of_material", "Author_of_Material_F7"))

    journal_name = _clean_source_title(_value(row, "journal_name", "JournalName"))
    material_title = _clean_source_title(
        _value(row, "title_of_material", "Title_of_Material_F9")
    )

    if journal_name:
        if material_title and not _same_text(material_title, journal_name):
            _append_sentence(parts, material_title)
        source_title = journal_name
    else:
        source_title = material_title

    if source_title:
        parts.append("// " + _ensure_sentence(source_title))

    _append_sentence(parts, _value(row, "date_of_publication", "Date_of_Publication_F20", "year"))
    _append_sentence(parts, _format_volume(_value(row, "volume", "VolumeID_F22"), labels))
    _append_sentence(parts, _format_issue(_value(row, "issue", "IssueID_F24")))
    _append_sentence(parts, _format_pages(_pages(row), labels))
    _append_sentence(parts, _format_extent(_value(row, "extent_of_work", "ExtentOfWork_F26"), labels))
    _append_sentence(parts, _format_place_publisher(row))
    _append_sentence(parts, _format_edition(_value(row, "edition", "Edition_F15"), labels))
    _append_sentence(parts, _value(row, "date_of_meeting", "DateOfMeeting_F12"))
    _append_sentence(parts, _format_labeled_value("ISBN", _value(row, "isbn", "ISBN_F41")))
    _append_sentence(parts, _format_labeled_value("DOI", _value(row, "doi", "DOI")))

    return _join_parts(parts)


def _build_monograph_reference(
    row: Mapping[str, Any],
    labels: ReferenceLabels,
) -> str:
    author = _value(row, "author_analitic", "Author_Analitic_F1")
    title = _value(row, "title_analitic", "Title_Analitic_F4", "title")
    material_title = _clean_source_title(
        _value(row, "title_of_material", "Title_of_Material_F9")
    )

    parts: list[str] = []

    if not author:
        _append_sentence(parts, material_title or title)
        _append_sentence(parts, _format_place_publisher(row))
        _append_sentence(parts, _value(row, "date_of_publication", "Date_of_Publication_F20", "year"))
        _append_sentence(parts, _format_extent(_value(row, "extent_of_work", "ExtentOfWork_F26"), labels))
    else:
        _append_sentence(parts, author)
        _append_sentence(parts, title)

        if material_title:
            parts.append("// " + _ensure_sentence(material_title))

        _append_sentence(parts, _format_place_publisher(row))
        _append_sentence(parts, _value(row, "date_of_publication", "Date_of_Publication_F20", "year"))
        _append_sentence(parts, _format_pages(_pages(row), labels))

    _append_sentence(parts, _format_labeled_value("ISBN", _value(row, "isbn", "ISBN_F41")))
    _append_sentence(parts, _format_labeled_value("DOI", _value(row, "doi", "DOI")))

    return _join_parts(parts)


def _join_parts(parts: list[str]) -> str:
    return " ".join(part for part in parts if part)


def _append_sentence(parts: list[str], value: Any) -> None:
    sentence = _ensure_sentence(value)
    if sentence:
        parts.append(sentence)


def _ensure_sentence(value: Any) -> str | None:
    normalized = _normalize_value(value)
    if not normalized:
        return None

    if VALUE_END_RE.search(normalized):
        return normalized

    return normalized + "."


def _normalize_value(value: Any) -> str | None:
    if value is None:
        return None

    normalized = str(value).strip()
    if not normalized:
        return None

    normalized = re.sub(r"\s+", " ", normalized)
    return normalized or None


def _value(row: Mapping[str, Any], *keys: str) -> str | None:
    for key in keys:
        if key in row:
            value = _normalize_value(row.get(key))
            if value:
                return value

    return None


def _is_foreign_record(row: Mapping[str, Any]) -> bool:
    authors = _value(
        row,
        "author_analitic",
        "Author_Analitic_F1",
        "author_of_material",
        "Author_of_Material_F7",
    )
    if not authors:
        return False

    return bool(LATIN_RE.search(authors[:64]))


def _clean_source_title(value: Any) -> str | None:
    normalized = _normalize_value(value)
    if not normalized:
        return None

    normalized = re.sub(r"^/+\s*", "", normalized)
    normalized = normalized.strip()
    return normalized or None


def _same_text(left: str, right: str) -> bool:
    return _compare_text(left) == _compare_text(right)


def _compare_text(value: str) -> str:
    normalized = _clean_source_title(value) or ""
    normalized = normalized.lower()
    normalized = re.sub(r"[^\w]+", "", normalized, flags=re.UNICODE)
    return normalized


def _format_volume(value: Any, labels: ReferenceLabels) -> str | None:
    normalized = _strip_leading_number_label(value)
    if not normalized:
        return None

    if re.match(r"^(v\.|\u0442\.)\s+", normalized, flags=re.IGNORECASE):
        return normalized

    return f"{labels.volume} {normalized}"


def _format_issue(value: Any) -> str | None:
    normalized = _strip_leading_number_label(value)
    if not normalized:
        return None

    normalized = re.sub(r"^(no\.?|n\.?|\u2116)\s*", "", normalized, flags=re.IGNORECASE)
    return f"\u2013 \u2116 {normalized}"


def _format_pages(value: Any, labels: ReferenceLabels) -> str | None:
    normalized = _strip_leading_number_label(value)
    if not normalized:
        return None

    if re.match(r"^(p\.|pp\.|\u0441\.)\s+", normalized, flags=re.IGNORECASE):
        return normalized

    return f"{labels.pages} {normalized}"


def _format_extent(value: Any, labels: ReferenceLabels) -> str | None:
    normalized = _normalize_value(value)
    if not normalized:
        return None

    if re.search(r"(\bp\.?$|\bpp\.?$|\b\u0441\.?$|\b\u0441\u0442\u0440\.?$)", normalized, re.IGNORECASE):
        return normalized

    return f"{normalized} {labels.extent_unit}"


def _format_edition(value: Any, labels: ReferenceLabels) -> str | None:
    normalized = _normalize_value(value)
    if not normalized:
        return None

    if re.search(r"(\bed\.?|\b\u0440\u0435\u0434\.?)", normalized, re.IGNORECASE):
        return normalized

    return f"{normalized} {labels.editor}"


def _format_labeled_value(label: str, value: Any) -> str | None:
    normalized = _normalize_value(value)
    if not normalized:
        return None

    normalized = re.sub(rf"^{label}\s*:\s*", "", normalized, flags=re.IGNORECASE)
    return f"{label}: {normalized}"


def _format_place_publisher(row: Mapping[str, Any]) -> str | None:
    place = _clean_location_part(_value(row, "place_name", "PlaceName"))
    publisher = _clean_location_part(_value(row, "publisher_name", "PublisherName"))

    if place and publisher:
        return f"{place}: {publisher}"
    if place:
        return place
    return publisher


def _clean_location_part(value: Any) -> str | None:
    normalized = _clean_source_title(value)
    if not normalized:
        return None

    normalized = re.sub(r"^[\s./-]+", "", normalized)
    normalized = normalized.rstrip(" :;,")
    return normalized or None


def _strip_leading_number_label(value: Any) -> str | None:
    normalized = _normalize_value(value)
    if not normalized:
        return None

    normalized = re.sub(r"^[\s:;,\u2013-]+", "", normalized)
    return normalized or None


def _pages(row: Mapping[str, Any]) -> str | None:
    return _value(row, "pages", "Pages_F25") or _value(row, "pages_fallback")


def _cleanup_reference(value: str) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    normalized = re.sub(r"\s+([.,;:])", r"\1", normalized)
    normalized = re.sub(r"\s+([)])", r"\1", normalized)
    normalized = re.sub(r"([(])\s+", r"\1", normalized)
    normalized = re.sub(r"\.{2,}", ".", normalized)
    normalized = re.sub(r":{2,}", ":", normalized)
    normalized = re.sub(r"(?:\s*\u2013\s*){2,}", " \u2013 ", normalized)
    normalized = re.sub(r"\s*//\s*", " // ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    normalized = re.sub(r"\.\s*$", "", normalized)
    return normalized


def _null_string_sql(alias: str, column: str) -> str:
    return f"NULLIF(TRIM(CAST({alias}.`{column}` AS CHAR)), '')"


@lru_cache(maxsize=16)
def _get_cached_table_columns(bind_id: int, table_name: str, bind: Any) -> frozenset[str]:
    del bind_id
    inspector = inspect(bind)
    return frozenset(column["name"] for column in inspector.get_columns(table_name))


def _get_table_columns(db: Session, table_name: str) -> frozenset[str]:
    bind = db.get_bind()
    try:
        return _get_cached_table_columns(id(bind), table_name, bind)
    except SQLAlchemyError:
        return frozenset()
