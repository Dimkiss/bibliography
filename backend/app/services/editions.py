from __future__ import annotations

import math
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.article import PaginationMeta
from app.schemas.edition import (
    EditionDetailMetricItem,
    EditionDetailResponse,
    EditionFilterOption,
    EditionFiltersResponse,
    EditionListItem,
    EditionListResponse,
    EditionMetricHistoryItem,
    EditionPublicationItem,
    RelatedEditionItem,
)
from app.services.articles import pdf_files

DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100


class EditionNotFoundError(Exception):
    pass

METRIC_LEVEL_OPTIONS: list[EditionFilterOption] = [
    EditionFilterOption(value="q1", label="Q1"),
    EditionFilterOption(value="q2", label="Q2"),
    EditionFilterOption(value="q3", label="Q3"),
    EditionFilterOption(value="q4", label="Q4"),
]

EDITION_TYPE_OPTIONS: list[EditionFilterOption] = [
    EditionFilterOption(value="monograph", label="Монография"),
    EditionFilterOption(value="book", label="Книга/сборник"),
    EditionFilterOption(value="conference", label="Материалы конференции"),
    EditionFilterOption(value="patent_method", label="Патенты и методики"),
    EditionFilterOption(value="other", label="Другое"),
]

PERIODICAL_SORT_FIELD_MAP = {
    "title": "jn.JournalName",
    "issn": "jn.ISSN",
    "white_list": "COALESCE(j.LWL, 0)",
    "rinc": "COALESCE(j.Rints, 0)",
    "vak": "COALESCE(j.BAK, 0)",
}

NONPERIODICAL_TITLE_EXPR = """
    COALESCE(
        NULLIF(a.Title_of_Material_F9, ''),
        NULLIF(a.Title_Analitic_F4, ''),
        NULLIF(a.Edition_F15, '')
    )
"""

NONPERIODICAL_EDITION_KEY_EXPR = """
    CASE
        WHEN NULLIF(a.Title_of_Material_F9, '') LIKE '//%' THEN CONCAT(
            'material:',
            LOWER(TRIM(LEADING '/' FROM TRIM(a.Title_of_Material_F9)))
        )
        ELSE CONCAT('record:', a.Record_ID)
    END
"""

NONPERIODICAL_CONTRIBUTORS_EXPR = """
    COALESCE(
        NULLIF(a.Author_of_Material_F7, ''),
        NULLIF(a.Author_Analitic_F1, ''),
        (
            SELECT GROUP_CONCAT(DISTINCT au.authorName ORDER BY au.authorName SEPARATOR ', ')
            FROM articlehasauthor aha
            JOIN authors au ON au.authorID = aha.authorID_f
            WHERE aha.Record_ID_f = a.Record_ID
        )
    )
"""

NONPERIODICAL_SORT_FIELD_MAP = {
    "title": "title",
    "year": "year",
    "isbn": "identifier",
    "tirage": "tirage",
    "type": "work_form_type",
}


def _normalize_str_list(values: list[str] | None) -> list[str]:
    if not values:
        return []

    normalized: list[str] = []
    for value in values:
        stripped = value.strip()
        if stripped:
            normalized.append(stripped)

    return normalized


def _build_in_clause(prefix: str, values: list[str], params: dict[str, Any]) -> str:
    placeholders: list[str] = []

    for index, value in enumerate(values):
        key = f"{prefix}_{index}"
        placeholders.append(f":{key}")
        params[key] = value

    return ", ".join(placeholders)


def _quartile_rank_expr(column: str) -> str:
    value_expr = f"UPPER(TRIM(COALESCE(NULLIF({column}, ''), '')))"

    return f"""
        CASE {value_expr}
            WHEN 'Q1' THEN 4
            WHEN '1' THEN 4
            WHEN 'Q2' THEN 3
            WHEN '2' THEN 3
            WHEN 'Q3' THEN 2
            WHEN '3' THEN 2
            WHEN 'Q4' THEN 1
            WHEN '4' THEN 1
            ELSE 0
        END
    """


def _normalize_quartile(value: str | None) -> str | None:
    normalized = (value or "").strip().upper()

    if not normalized:
        return None

    if normalized in {"1", "2", "3", "4"}:
        return f"Q{normalized}"

    return normalized


def _format_boolean(value: Any) -> bool:
    return bool(value)


def _parse_csv_list(value: str | None) -> list[str]:
    if not value:
        return []

    return [item.strip() for item in value.split("|||") if item.strip()]


def _parse_metric_history(
    value: str | None,
    *,
    normalize_value: bool = False,
) -> list[EditionMetricHistoryItem]:
    items: list[EditionMetricHistoryItem] = []

    for item in _parse_csv_list(value):
        year_value, separator, quartile_value = item.partition(":")
        if not separator:
            continue

        try:
            year = int(year_value)
        except ValueError:
            continue

        items.append(
            EditionMetricHistoryItem(
                year=year,
                value=(
                    _normalize_quartile(quartile_value)
                    if normalize_value
                    else (quartile_value.strip() or None)
                ),
            )
        )

    return items


def _clean_display_text(value: str | None) -> str | None:
    normalized = (value or "").strip()

    while normalized.startswith("/"):
        normalized = normalized[1:].strip()

    return normalized or None


def _format_date_value(value: Any) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else value


def _format_decimal_value(value: Any) -> str | None:
    if value is None:
        return None

    normalized = str(value).strip()
    return normalized or None


def _build_metric_filter(
    levels: list[str],
    *,
    params: dict[str, Any],
    table_alias: str,
) -> str | None:
    normalized_levels = [
        level.strip().lower().replace("q", "")
        for level in levels
        if level.strip().lower().replace("q", "") in {"1", "2", "3", "4"}
    ]

    if not normalized_levels:
        return None

    quartile_values: list[str] = []
    white_list_values: list[str] = []

    for level in normalized_levels:
        quartile_values.extend([f"Q{level}", level])
        white_list_values.append(level)

    quartile_clause = _build_in_clause("metric_q", quartile_values, params)
    white_list_clause = _build_in_clause("metric_lwl", white_list_values, params)

    return f"""
    (
        UPPER(TRIM(COALESCE(NULLIF({table_alias}.Quartile, ''), ''))) IN ({quartile_clause})
        OR UPPER(TRIM(COALESCE(NULLIF({table_alias}.QuartileScopus, ''), ''))) IN ({quartile_clause})
        OR CAST({table_alias}.LWL AS CHAR) IN ({white_list_clause})
    )
    """


def _build_periodical_filters(
    *,
    params: dict[str, Any],
    query: str | None,
    year_from: int | None,
    year_to: int | None,
    metric_levels: list[str],
) -> str:
    conditions: list[str] = []

    if query and query.strip():
        params["query"] = f"%{query.strip()}%"
        conditions.append(
            """
            (
                jn.JournalName LIKE :query
                OR jn.ISSN LIKE :query
                OR EXISTS (
                    SELECT 1
                    FROM journalsinonims js
                    WHERE js.JN_ID_f = jn.JN_ID
                      AND js.Sinonim LIKE :query
                )
            )
            """
        )

    if year_from is not None or year_to is not None:
        year_conditions: list[str] = ["jy.JN_ID_f = jn.JN_ID"]

        if year_from is not None:
            params["year_from"] = year_from
            year_conditions.append("jy.Year >= :year_from")

        if year_to is not None:
            params["year_to"] = year_to
            year_conditions.append("jy.Year <= :year_to")

        conditions.append(
            """
            EXISTS (
                SELECT 1
                FROM journals jy
                WHERE
            """
            + " AND ".join(year_conditions)
            + """
            )
            """
        )

    metric_filter = _build_metric_filter(
        metric_levels,
        params=params,
        table_alias="j",
    )
    if metric_filter:
        conditions.append(metric_filter)

    if not conditions:
        return ""

    return "\nAND " + "\nAND ".join(f"({condition.strip()})" for condition in conditions)


def _build_nonperiodical_type_condition(
    edition_types: list[str],
    params: dict[str, Any],
) -> str | None:
    conditions: list[str] = []

    for edition_type in edition_types:
        value = edition_type.strip()

        if value == "monograph":
            conditions.append(
                """
                (
                    EXISTS (
                        SELECT 1
                        FROM articlehastop aht
                        WHERE aht.Record_ID_f = a.Record_ID
                          AND aht.TypeOfPublication_f = 'MO'
                    )
                    AND NOT EXISTS (
                        SELECT 1
                        FROM articlehastop aht
                        WHERE aht.Record_ID_f = a.Record_ID
                          AND aht.TypeOfPublication_f = 'GL'
                    )
                )
                """
            )
        elif value == "book":
            conditions.append(
                """
                (
                    (
                        EXISTS (
                            SELECT 1
                            FROM articlehastop aht
                            WHERE aht.Record_ID_f = a.Record_ID
                              AND aht.TypeOfPublication_f = 'GL'
                        )
                        AND NOT EXISTS (
                            SELECT 1
                            FROM articlehastop aht
                            WHERE aht.Record_ID_f = a.Record_ID
                              AND aht.TypeOfPublication_f IN (
                                  'AR', 'AS', 'DI', 'DO', 'LI',
                                  'MA', 'MO', 'MP', 'OT', 'PA', 'PD',
                                  'SD', 'TE', 'TR'
                              )
                        )
                    )
                    OR (
                        EXISTS (
                            SELECT 1
                            FROM articlehastop aht
                            WHERE aht.Record_ID_f = a.Record_ID
                              AND aht.TypeOfPublication_f IN ('KN', 'SB', 'AT', 'BU', 'SP', 'UC')
                        )
                        AND NOT EXISTS (
                            SELECT 1
                            FROM articlehastop aht
                            WHERE aht.Record_ID_f = a.Record_ID
                              AND aht.TypeOfPublication_f IN (
                                  'AR', 'AS', 'DI', 'DO', 'GL', 'LI',
                                  'MA', 'MO', 'MP', 'OT', 'PA', 'PD',
                                  'SD', 'TE', 'TR'
                              )
                        )
                    )
                    OR (
                        a.WorkFormType_f = 'B'
                        AND NOT EXISTS (
                        SELECT 1
                        FROM articlehastop aht
                        WHERE aht.Record_ID_f = a.Record_ID
                          AND aht.TypeOfPublication_f IN (
                              'AR', 'AS', 'DI', 'DO', 'GL', 'LI',
                              'MA', 'MO', 'MP', 'OT', 'PA', 'PD',
                              'SD', 'TE', 'TR'
                          )
                        )
                    )
                )
                """
            )
        elif value == "conference":
            conditions.append(
                """
                (
                    a.WorkFormType_f = 'C'
                    OR EXISTS (
                        SELECT 1
                        FROM articlehastop aht
                        WHERE aht.Record_ID_f = a.Record_ID
                          AND aht.TypeOfPublication_f IN ('MA', 'DO', 'PD', 'SD', 'TE', 'TR')
                    )
                )
                """
            )
        elif value == "patent_method":
            conditions.append(
                """
                (
                    a.WorkFormType_f = 'M'
                    OR EXISTS (
                        SELECT 1
                        FROM articlehastop aht
                        WHERE aht.Record_ID_f = a.Record_ID
                          AND aht.TypeOfPublication_f IN ('PA', 'MP', 'AS', 'LI')
                    )
                )
                """
            )
        elif value == "report":
            conditions.append(
                """
                (
                    a.WorkFormType_f = 'R'
                    OR EXISTS (
                        SELECT 1
                        FROM articlehastop aht
                        WHERE aht.Record_ID_f = a.Record_ID
                          AND aht.TypeOfPublication_f IN ('OT')
                    )
                )
                """
            )
        elif value == "dissertation":
            conditions.append(
                """
                (
                    a.WorkFormType_f = 'D'
                    OR EXISTS (
                        SELECT 1
                        FROM articlehastop aht
                        WHERE aht.Record_ID_f = a.Record_ID
                          AND aht.TypeOfPublication_f IN ('DI', 'AR')
                    )
                )
                """
            )
        elif value == "other":
            conditions.append(
                """
                (
                    a.WorkFormType_f NOT IN ('B', 'C', 'D', 'J', 'M', 'R')
                    AND NOT EXISTS (
                        SELECT 1
                        FROM articlehastop aht
                        WHERE aht.Record_ID_f = a.Record_ID
                          AND aht.TypeOfPublication_f IN (
                              'AR', 'AS', 'AT', 'BU', 'DI', 'DO', 'GL',
                              'KN', 'LI', 'MA', 'MO', 'MP', 'OT', 'PA',
                              'PD', 'SB', 'SD', 'SP', 'TE', 'TR', 'UC'
                          )
                    )
                )
                """
            )

    if not conditions:
        return None

    return "(" + " OR ".join(f"({condition.strip()})" for condition in conditions) + ")"


def _build_nonperiodical_filters(
    *,
    params: dict[str, Any],
    query: str | None,
    year_from: int | None,
    year_to: int | None,
    edition_types: list[str],
) -> str:
    conditions: list[str] = ["COALESCE(a.WorkFormType_f, '') <> 'J'"]

    if query and query.strip():
        params["query"] = f"%{query.strip()}%"
        conditions.append(
            f"""
            (
                {NONPERIODICAL_TITLE_EXPR} LIKE :query
                OR a.ISBN_F41 LIKE :query
                OR {NONPERIODICAL_CONTRIBUTORS_EXPR} LIKE :query
                OR pn.PublisherName LIKE :query
                OR pp.PlaceName LIKE :query
            )
            """
        )

    if year_from is not None:
        params["year_from"] = year_from
        conditions.append("a.Date_of_Publication_F20 >= :year_from")

    if year_to is not None:
        params["year_to"] = year_to
        conditions.append("a.Date_of_Publication_F20 <= :year_to")

    type_filter = _build_nonperiodical_type_condition(edition_types, params)
    if type_filter:
        conditions.append(type_filter)

    return "\nAND " + "\nAND ".join(f"({condition.strip()})" for condition in conditions)


def _derive_nonperiodical_type(row: dict[str, Any]) -> str:
    flags = set(_parse_csv_list(row.get("publication_type_flags_csv")))
    names = _parse_csv_list(row.get("publication_type_names_csv"))
    work_form_type = (row.get("work_form_type") or "").strip()

    if work_form_type == "M" or flags.intersection({"PA", "AS", "LI", "MP"}):
        return "Патенты и методики"

    if flags.intersection({"OT"}) or work_form_type == "R":
        return "Другое"

    if "MO" in flags and "GL" not in flags:
        return "Монография"

    if flags.intersection({"MA", "DO", "PD", "SD", "TE", "TR"}) or work_form_type == "C":
        return "Материалы конференции"

    if "GL" in flags:
        return "Книга/сборник"

    if flags.intersection({"DI", "AR"}) or work_form_type == "D":
        return "Другое"

    if flags.intersection({"KN", "SB", "AT", "BU", "SP", "UC"}) or work_form_type == "B":
        return "Книга/сборник"

    return names[0] if names else "Другое"


def _derive_contributors_label(row: dict[str, Any], publication_type: str) -> str | None:
    if not row.get("contributors"):
        return None

    if publication_type == "Патенты и методики":
        return "Авторы"

    if row.get("author_of_material"):
        return "Редакторы"

    return "Авторы"


def _build_edition_publication_item(row: dict[str, Any]) -> EditionPublicationItem:
    return EditionPublicationItem(
        id=int(row["id"]),
        title=_clean_display_text(row.get("title")),
        authors=_clean_display_text(row.get("authors")),
        doi=row.get("doi"),
        year=row.get("year"),
        volume=_clean_display_text(row.get("volume")),
        issue=_clean_display_text(row.get("issue")),
        pages=_clean_display_text(row.get("pages")),
        has_pdf=pdf_files.article_pdf_exists(int(row["id"])),
    )


def _list_periodical_editions(
    *,
    db: Session,
    page: int,
    page_size: int,
    query: str | None,
    year_from: int | None,
    year_to: int | None,
    metric_levels: list[str],
    sort_by: str,
    sort_order: str,
    include_total: bool,
    known_total: int | None,
) -> EditionListResponse:
    params: dict[str, Any] = {}
    filters_sql = _build_periodical_filters(
        params=params,
        query=query,
        year_from=year_from,
        year_to=year_to,
        metric_levels=metric_levels,
    )

    latest_journal_join = """
        LEFT JOIN journals j ON j.J_ID = (
            SELECT latest_j.J_ID
            FROM journals latest_j
            WHERE latest_j.JN_ID_f = jn.JN_ID
            ORDER BY latest_j.Year DESC, latest_j.J_ID DESC
            LIMIT 1
        )
    """

    if include_total or known_total is None:
        total = int(
            db.execute(
                text(
                    f"""
                    SELECT COUNT(*) AS total
                    FROM journalnames jn
                    {latest_journal_join}
                    WHERE 1 = 1
                    {filters_sql}
                    """
                ),
                params,
            ).scalar()
            or 0
        )
    else:
        total = known_total

    sort_by = (sort_by or "title").lower()
    sort_order = (sort_order or "asc").lower()
    sort_dir = "ASC" if sort_order == "asc" else "DESC"

    if sort_by == "wos":
        sort_expr = _quartile_rank_expr("j.Quartile")
    elif sort_by == "scopus":
        sort_expr = _quartile_rank_expr("j.QuartileScopus")
    else:
        sort_expr = PERIODICAL_SORT_FIELD_MAP.get(
            sort_by,
            PERIODICAL_SORT_FIELD_MAP["title"],
        )

    page_params = dict(params)
    page_params["limit"] = page_size
    page_params["offset"] = (page - 1) * page_size

    id_rows = db.execute(
        text(
            f"""
            SELECT
                jn.JN_ID AS source_id
            FROM journalnames jn
            {latest_journal_join}
            WHERE 1 = 1
            {filters_sql}
            ORDER BY {sort_expr} {sort_dir}, jn.JournalName ASC, jn.JN_ID ASC
            LIMIT :limit OFFSET :offset
            """
        ),
        page_params,
    ).mappings().all()
    source_ids = [int(row["source_id"]) for row in id_rows]

    if not source_ids:
        return EditionListResponse(
            items=[],
            pagination=PaginationMeta(
                page=page,
                page_size=page_size,
                total=total,
                total_pages=math.ceil(total / page_size) if total else 0,
            ),
        )

    id_placeholders = ", ".join(
        f":source_id_{index}" for index in range(len(source_ids))
    )
    order_placeholders = ", ".join(
        f":source_id_{index}" for index in range(len(source_ids))
    )
    data_params: dict[str, Any] = {
        f"source_id_{index}": source_id
        for index, source_id in enumerate(source_ids)
    }

    rows = db.execute(
        text(
            f"""
            SELECT
                jn.JN_ID AS source_id,
                jn.JournalName AS title,
                NULLIF(jn.ISSN, '') AS identifier,
                j.Year AS year,
                NULLIF(NULLIF(CAST(j.LWL AS CHAR), ''), '0') AS white_list_level,
                NULLIF(j.Quartile, '') AS wos_quartile,
                NULLIF(j.QuartileScopus, '') AS scopus_quartile,
                (
                    SELECT GROUP_CONCAT(
                        CONCAT(jl.Year, ':', COALESCE(NULLIF(NULLIF(CAST(jl.LWL AS CHAR), ''), '0'), '-'))
                        ORDER BY jl.Year DESC
                        SEPARATOR '|||'
                    )
                    FROM journals jl
                    WHERE jl.JN_ID_f = jn.JN_ID
                ) AS white_list_levels_csv,
                (
                    SELECT GROUP_CONCAT(
                        CONCAT(jw.Year, ':', COALESCE(NULLIF(jw.Quartile, ''), '-'))
                        ORDER BY jw.Year DESC
                        SEPARATOR '|||'
                    )
                    FROM journals jw
                    WHERE jw.JN_ID_f = jn.JN_ID
                ) AS wos_quartiles_csv,
                (
                    SELECT GROUP_CONCAT(
                        CONCAT(js.Year, ':', COALESCE(NULLIF(js.QuartileScopus, ''), '-'))
                        ORDER BY js.Year DESC
                        SEPARATOR '|||'
                    )
                    FROM journals js
                    WHERE js.JN_ID_f = jn.JN_ID
                ) AS scopus_quartiles_csv,
                COALESCE(j.Rints, 0) AS rinc_flag,
                COALESCE(j.BAK, 0) AS vak_flag,
                (
                    SELECT COUNT(DISTINCT a.Record_ID)
                    FROM articles a
                    JOIN journals article_j ON article_j.J_ID = a.Journal_ID_f
                    WHERE article_j.JN_ID_f = jn.JN_ID
                ) AS publication_count
            FROM journalnames jn
            {latest_journal_join}
            WHERE jn.JN_ID IN ({id_placeholders})
            ORDER BY FIELD(jn.JN_ID, {order_placeholders})
            """
        ),
        data_params,
    ).mappings().all()

    items = [
        EditionListItem(
            id=f"periodical:{row['source_id']}",
            source_id=int(row["source_id"]),
            kind="periodical",
            title=_clean_display_text(row.get("title")),
            identifier=row.get("identifier"),
            identifier_label="ISSN",
            year=row.get("year"),
            publication_type="Журнал",
            white_list_level=row.get("white_list_level"),
            wos_quartile=_normalize_quartile(row.get("wos_quartile")),
            scopus_quartile=_normalize_quartile(row.get("scopus_quartile")),
            white_list_levels=_parse_metric_history(row.get("white_list_levels_csv")),
            wos_quartiles=_parse_metric_history(
                row.get("wos_quartiles_csv"),
                normalize_value=True,
            ),
            scopus_quartiles=_parse_metric_history(
                row.get("scopus_quartiles_csv"),
                normalize_value=True,
            ),
            rinc=_format_boolean(row.get("rinc_flag")),
            vak=_format_boolean(row.get("vak_flag")),
            publication_count=int(row.get("publication_count") or 0),
        )
        for row in rows
    ]

    return EditionListResponse(
        items=items,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=math.ceil(total / page_size) if total else 0,
        ),
    )


def _list_nonperiodical_editions(
    *,
    db: Session,
    page: int,
    page_size: int,
    query: str | None,
    year_from: int | None,
    year_to: int | None,
    edition_types: list[str],
    sort_by: str,
    sort_order: str,
    include_total: bool,
    known_total: int | None,
) -> EditionListResponse:
    params: dict[str, Any] = {}
    filters_sql = _build_nonperiodical_filters(
        params=params,
        query=query,
        year_from=year_from,
        year_to=year_to,
        edition_types=edition_types,
    )

    if include_total or known_total is None:
        total = int(
            db.execute(
                text(
                    f"""
                    SELECT COUNT(DISTINCT {NONPERIODICAL_EDITION_KEY_EXPR}) AS total
                    FROM articles a
                    LEFT JOIN places pp ON pp.P_ID = a.PlaceOfPublication_F18_f
                    LEFT JOIN publishernames pn ON pn.PN_ID = a.PublisherName_F19_f
                    WHERE 1 = 1
                    {filters_sql}
                    """
                ),
                params,
            ).scalar()
            or 0
        )
    else:
        total = known_total

    sort_by = (sort_by or "title").lower()
    sort_order = (sort_order or "asc").lower()
    sort_dir = "ASC" if sort_order == "asc" else "DESC"
    sort_expr = NONPERIODICAL_SORT_FIELD_MAP.get(
        sort_by,
        NONPERIODICAL_SORT_FIELD_MAP["title"],
    )

    page_params = dict(params)
    page_params["limit"] = page_size
    page_params["offset"] = (page - 1) * page_size

    id_rows = db.execute(
        text(
            f"""
            SELECT
                source_id
            FROM (
                SELECT
                    MIN(a.Record_ID) AS source_id,
                    MIN(a.WorkFormType_f) AS work_form_type,
                    MIN({NONPERIODICAL_TITLE_EXPR}) AS title,
                    MAX(a.ISBN_F41) AS identifier,
                    MIN(a.Date_of_Publication_F20) AS year,
                    MAX(NULLIF(jaa.Tirage, '')) AS tirage
                FROM articles a
                LEFT JOIN places pp ON pp.P_ID = a.PlaceOfPublication_F18_f
                LEFT JOIN publishernames pn ON pn.PN_ID = a.PublisherName_F19_f
                LEFT JOIN journalarticlesattributes jaa ON jaa.Record_ID_f = a.Record_ID
                WHERE 1 = 1
                {filters_sql}
                GROUP BY {NONPERIODICAL_EDITION_KEY_EXPR}
            ) editions
            ORDER BY {sort_expr} {sort_dir}, source_id DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        page_params,
    ).mappings().all()
    source_ids = [int(row["source_id"]) for row in id_rows]

    if not source_ids:
        return EditionListResponse(
            items=[],
            pagination=PaginationMeta(
                page=page,
                page_size=page_size,
                total=total,
                total_pages=math.ceil(total / page_size) if total else 0,
            ),
        )

    id_placeholders = ", ".join(
        f":source_id_{index}" for index in range(len(source_ids))
    )
    order_placeholders = ", ".join(
        f":source_id_{index}" for index in range(len(source_ids))
    )
    data_params: dict[str, Any] = {
        f"source_id_{index}": source_id
        for index, source_id in enumerate(source_ids)
    }

    rows = db.execute(
        text(
            f"""
            SELECT
                a.Record_ID AS source_id,
                a.WorkFormType_f AS work_form_type,
                a.Author_of_Material_F7 AS author_of_material,
                {NONPERIODICAL_TITLE_EXPR} AS title,
                {NONPERIODICAL_CONTRIBUTORS_EXPR} AS contributors,
                a.ISBN_F41 AS identifier,
                a.Date_of_Publication_F20 AS year,
                pn.PublisherName AS publisher,
                pp.PlaceName AS place,
                (
                    SELECT jaa.Tirage
                    FROM journalarticlesattributes jaa
                    WHERE jaa.Record_ID_f = a.Record_ID
                      AND NULLIF(jaa.Tirage, '') IS NOT NULL
                    LIMIT 1
                ) AS tirage,
                (
                    SELECT GROUP_CONCAT(DISTINCT aht.TypeOfPublication_f ORDER BY aht.TypeOfPublication_f SEPARATOR '|||')
                    FROM articlehastop aht
                    WHERE aht.Record_ID_f = a.Record_ID
                ) AS publication_type_flags_csv,
                (
                    SELECT GROUP_CONCAT(DISTINCT top.TOP_Name ORDER BY top.TOP_Name SEPARATOR '|||')
                    FROM articlehastop aht
                    JOIN typesofpublications top ON top.TOP_Flag = aht.TypeOfPublication_f
                    WHERE aht.Record_ID_f = a.Record_ID
                ) AS publication_type_names_csv
            FROM articles a
            LEFT JOIN places pp ON pp.P_ID = a.PlaceOfPublication_F18_f
            LEFT JOIN publishernames pn ON pn.PN_ID = a.PublisherName_F19_f
            WHERE a.Record_ID IN ({id_placeholders})
            ORDER BY FIELD(a.Record_ID, {order_placeholders})
            """
        ),
        data_params,
    ).mappings().all()

    items: list[EditionListItem] = []
    for row in rows:
        row_dict = dict(row)
        publication_type = _derive_nonperiodical_type(row_dict)

        items.append(
            EditionListItem(
                id=f"nonperiodical:{row_dict['source_id']}",
                source_id=int(row_dict["source_id"]),
                kind="nonperiodical",
                title=_clean_display_text(row_dict.get("title")),
                identifier=row_dict.get("identifier"),
                identifier_label="ISBN",
                year=row_dict.get("year"),
                publication_type=publication_type,
                contributors=_clean_display_text(row_dict.get("contributors")),
                contributors_label=_derive_contributors_label(
                    row_dict,
                    publication_type,
                ),
                publisher=row_dict.get("publisher"),
                place=row_dict.get("place"),
                tirage=row_dict.get("tirage"),
            )
        )

    return EditionListResponse(
        items=items,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=math.ceil(total / page_size) if total else 0,
        ),
    )


def _get_related_periodical_editions(
    db: Session,
    source_id: int,
) -> list[RelatedEditionItem]:
    rows = db.execute(
        text(
            """
            SELECT DISTINCT
                related.source_id,
                related.title,
                related.identifier
            FROM (
                SELECT
                    related_jn.JN_ID AS source_id,
                    related_jn.JournalName AS title,
                    NULLIF(related_jn.ISSN, '') AS identifier
                FROM journalnames current_jn
                JOIN journalsinonims js
                  ON js.Sinonim = current_jn.JournalName
                  OR js.JournalName = current_jn.JournalName
                JOIN journalnames related_jn ON related_jn.JN_ID = js.JN_ID_f
                WHERE current_jn.JN_ID = :source_id

                UNION

                SELECT
                    related_jn.JN_ID AS source_id,
                    related_jn.JournalName AS title,
                    NULLIF(related_jn.ISSN, '') AS identifier
                FROM journalnames current_jn
                JOIN journalsinonims js ON js.JN_ID_f = current_jn.JN_ID
                JOIN journalnames related_jn ON related_jn.JournalName = js.Sinonim
                WHERE current_jn.JN_ID = :source_id
            ) related
            WHERE related.source_id <> :source_id
            ORDER BY related.title
            """
        ),
        {"source_id": source_id},
    ).mappings().all()

    return [
        RelatedEditionItem(
            kind="periodical",
            source_id=int(row["source_id"]),
            title=_clean_display_text(row.get("title")),
            identifier=row.get("identifier"),
        )
        for row in rows
    ]


def _get_periodical_detail(db: Session, source_id: int) -> EditionDetailResponse:
    row = db.execute(
        text(
            """
            SELECT
                jn.JN_ID AS source_id,
                jn.JournalName AS title,
                NULLIF(jn.ISSN, '') AS identifier,
                (
                    SELECT MAX(a.InsertDate)
                    FROM articles a
                    JOIN journals article_j ON article_j.J_ID = a.Journal_ID_f
                    WHERE article_j.JN_ID_f = jn.JN_ID
                ) AS insert_date
            FROM journalnames jn
            WHERE jn.JN_ID = :source_id
            """
        ),
        {"source_id": source_id},
    ).mappings().first()

    if row is None:
        raise EditionNotFoundError("Издание не найдено.")

    metric_rows = db.execute(
        text(
            """
            SELECT
                j.Year AS year,
                NULLIF(NULLIF(CAST(j.LWL AS CHAR), ''), '0') AS white_list_level,
                NULLIF(j.Quartile, '') AS wos_quartile,
                j.Impact_Factor AS impact_factor,
                j.FiveYearIF AS five_year_if,
                NULLIF(j.QuartileScopus, '') AS scopus_quartile,
                COALESCE(j.WOS, 0) AS wos_flag,
                COALESCE(j.Scopus, 0) AS scopus_flag,
                COALESCE(j.Rints, 0) AS rinc_flag,
                COALESCE(j.RintsCore, 0) AS rinc_core_flag,
                COALESCE(j.RSCI, 0) AS rsci_flag,
                COALESCE(j.Foreign_, 0) AS foreign_flag,
                COALESCE(j.BAK, 0) AS vak_flag
            FROM journals j
            WHERE j.JN_ID_f = :source_id
            ORDER BY j.Year DESC, j.J_ID DESC
            """
        ),
        {"source_id": source_id},
    ).mappings().all()

    publication_rows = db.execute(
        text(
            """
            SELECT
                a.Record_ID AS id,
                COALESCE(
                    NULLIF(a.Title_Analitic_F4, ''),
                    NULLIF(a.Title_of_Material_F9, ''),
                    NULLIF(a.Edition_F15, '')
                ) AS title,
                COALESCE(
                    NULLIF(a.Author_Analitic_F1, ''),
                    (
                        SELECT GROUP_CONCAT(au.authorName ORDER BY aha.AHA_ID SEPARATOR ', ')
                        FROM articlehasauthor aha
                        JOIN authors au ON au.authorID = aha.authorID_f
                        WHERE aha.Record_ID_f = a.Record_ID
                    )
                ) AS authors,
                a.DOI AS doi,
                a.Date_of_Publication_F20 AS year,
                a.VolumeID_F22 AS volume,
                a.IssueID_F24 AS issue,
                a.Pages_F25 AS pages
            FROM articles a
            JOIN journals j ON j.J_ID = a.Journal_ID_f
            WHERE j.JN_ID_f = :source_id
            ORDER BY
                a.Date_of_Publication_F20 DESC,
                CAST(NULLIF(a.VolumeID_F22, '') AS UNSIGNED) DESC,
                a.VolumeID_F22 DESC,
                CAST(NULLIF(a.IssueID_F24, '') AS UNSIGNED) ASC,
                CAST(NULLIF(a.Pages_F25, '') AS UNSIGNED) ASC,
                a.Record_ID ASC
            """
        ),
        {"source_id": source_id},
    ).mappings().all()

    row_dict = dict(row)

    return EditionDetailResponse(
        id=f"periodical:{source_id}",
        source_id=source_id,
        kind="periodical",
        title=_clean_display_text(row_dict.get("title")),
        identifier=row_dict.get("identifier"),
        identifier_label="ISSN",
        publication_type="Журнал",
        insert_date=_format_date_value(row_dict.get("insert_date")),
        metrics=[
            EditionDetailMetricItem(
                year=int(metric_row["year"]),
                white_list_level=metric_row.get("white_list_level"),
                wos_quartile=_normalize_quartile(metric_row.get("wos_quartile")),
                impact_factor=_format_decimal_value(metric_row.get("impact_factor")),
                five_year_if=_format_decimal_value(metric_row.get("five_year_if")),
                scopus_quartile=_normalize_quartile(metric_row.get("scopus_quartile")),
                wos=_format_boolean(metric_row.get("wos_flag")),
                scopus=_format_boolean(metric_row.get("scopus_flag")),
                rinc=_format_boolean(metric_row.get("rinc_flag")),
                rinc_core=_format_boolean(metric_row.get("rinc_core_flag")),
                rsci=_format_boolean(metric_row.get("rsci_flag")),
                foreign=_format_boolean(metric_row.get("foreign_flag")),
                vak=_format_boolean(metric_row.get("vak_flag")),
            )
            for metric_row in metric_rows
        ],
        publications=[
            _build_edition_publication_item(dict(publication_row))
            for publication_row in publication_rows
        ],
        related_editions=_get_related_periodical_editions(db, source_id),
    )


def _get_nonperiodical_detail(db: Session, source_id: int) -> EditionDetailResponse:
    row = db.execute(
        text(
            f"""
            SELECT
                a.Record_ID AS source_id,
                a.WorkFormType_f AS work_form_type,
                a.Author_of_Material_F7 AS author_of_material,
                {NONPERIODICAL_TITLE_EXPR} AS title,
                {NONPERIODICAL_CONTRIBUTORS_EXPR} AS contributors,
                a.ISBN_F41 AS identifier,
                a.Date_of_Publication_F20 AS year,
                a.DateOfMeeting_F12 AS date_of_meeting,
                pn.PublisherName AS publisher,
                pp.PlaceName AS place,
                a.InsertDate AS insert_date,
                {NONPERIODICAL_EDITION_KEY_EXPR} AS edition_key,
                (
                    SELECT jaa.Tirage
                    FROM journalarticlesattributes jaa
                    WHERE jaa.Record_ID_f = a.Record_ID
                      AND NULLIF(jaa.Tirage, '') IS NOT NULL
                    LIMIT 1
                ) AS tirage,
                (
                    SELECT GROUP_CONCAT(DISTINCT aht.TypeOfPublication_f ORDER BY aht.TypeOfPublication_f SEPARATOR '|||')
                    FROM articlehastop aht
                    WHERE aht.Record_ID_f = a.Record_ID
                ) AS publication_type_flags_csv,
                (
                    SELECT GROUP_CONCAT(DISTINCT top.TOP_Name ORDER BY top.TOP_Name SEPARATOR '|||')
                    FROM articlehastop aht
                    JOIN typesofpublications top ON top.TOP_Flag = aht.TypeOfPublication_f
                    WHERE aht.Record_ID_f = a.Record_ID
                ) AS publication_type_names_csv
            FROM articles a
            LEFT JOIN places pp ON pp.P_ID = a.PlaceOfPublication_F18_f
            LEFT JOIN publishernames pn ON pn.PN_ID = a.PublisherName_F19_f
            WHERE a.Record_ID = :source_id
              AND COALESCE(a.WorkFormType_f, '') <> 'J'
            """
        ),
        {"source_id": source_id},
    ).mappings().first()

    if row is None:
        raise EditionNotFoundError("Издание не найдено.")

    row_dict = dict(row)
    publication_type = _derive_nonperiodical_type(row_dict)
    edition_key = row_dict.get("edition_key")

    publication_rows = db.execute(
        text(
            f"""
            SELECT
                a.Record_ID AS id,
                COALESCE(
                    NULLIF(a.Title_Analitic_F4, ''),
                    NULLIF(a.Title_of_Material_F9, ''),
                    NULLIF(a.Edition_F15, '')
                ) AS title,
                COALESCE(
                    NULLIF(a.Author_Analitic_F1, ''),
                    (
                        SELECT GROUP_CONCAT(au.authorName ORDER BY aha.AHA_ID SEPARATOR ', ')
                        FROM articlehasauthor aha
                        JOIN authors au ON au.authorID = aha.authorID_f
                        WHERE aha.Record_ID_f = a.Record_ID
                    )
                ) AS authors,
                a.DOI AS doi,
                a.Date_of_Publication_F20 AS year,
                a.VolumeID_F22 AS volume,
                a.IssueID_F24 AS issue,
                a.Pages_F25 AS pages
            FROM articles a
            WHERE COALESCE(a.WorkFormType_f, '') <> 'J'
              AND {NONPERIODICAL_EDITION_KEY_EXPR} = :edition_key
            ORDER BY
                CAST(NULLIF(a.Pages_F25, '') AS UNSIGNED) ASC,
                a.Pages_F25 ASC,
                a.Record_ID ASC
            """
        ),
        {"edition_key": edition_key},
    ).mappings().all()

    return EditionDetailResponse(
        id=f"nonperiodical:{source_id}",
        source_id=source_id,
        kind="nonperiodical",
        title=_clean_display_text(row_dict.get("title")),
        identifier=row_dict.get("identifier"),
        identifier_label="ISBN",
        year=row_dict.get("year"),
        publication_type=publication_type,
        contributors=_clean_display_text(row_dict.get("contributors")),
        contributors_label=_derive_contributors_label(row_dict, publication_type),
        date_of_meeting=_clean_display_text(row_dict.get("date_of_meeting")),
        publisher=_clean_display_text(row_dict.get("publisher")),
        place=_clean_display_text(row_dict.get("place")),
        tirage=_clean_display_text(row_dict.get("tirage")),
        insert_date=_format_date_value(row_dict.get("insert_date")),
        publications=[
            _build_edition_publication_item(dict(publication_row))
            for publication_row in publication_rows
        ],
    )


def get_edition_detail(
    *,
    db: Session,
    kind: str,
    source_id: int,
) -> EditionDetailResponse:
    normalized_kind = "nonperiodical" if kind == "nonperiodical" else "periodical"

    if normalized_kind == "nonperiodical":
        return _get_nonperiodical_detail(db, source_id)

    return _get_periodical_detail(db, source_id)


def list_editions(
    *,
    db: Session,
    kind: str = "periodical",
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    query: str | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    metric_levels: list[str] | None = None,
    edition_types: list[str] | None = None,
    sort_by: str = "title",
    sort_order: str = "asc",
    include_total: bool = True,
    known_total: int | None = None,
) -> EditionListResponse:
    normalized_kind = "nonperiodical" if kind == "nonperiodical" else "periodical"

    if normalized_kind == "nonperiodical":
        return _list_nonperiodical_editions(
            db=db,
            page=page,
            page_size=page_size,
            query=query,
            year_from=year_from,
            year_to=year_to,
            edition_types=_normalize_str_list(edition_types),
            sort_by=sort_by,
            sort_order=sort_order,
            include_total=include_total,
            known_total=known_total,
        )

    return _list_periodical_editions(
        db=db,
        page=page,
        page_size=page_size,
        query=query,
        year_from=year_from,
        year_to=year_to,
        metric_levels=_normalize_str_list(metric_levels),
        sort_by=sort_by,
        sort_order=sort_order,
        include_total=include_total,
        known_total=known_total,
    )


def get_edition_filters(db: Session) -> EditionFiltersResponse:
    periodical_years = db.execute(
        text(
            """
            SELECT
                MIN(Year) AS year_min,
                MAX(Year) AS year_max
            FROM journals
            WHERE Year IS NOT NULL
            """
        )
    ).mappings().first()

    nonperiodical_years = db.execute(
        text(
            """
            SELECT
                MIN(Date_of_Publication_F20) AS year_min,
                MAX(Date_of_Publication_F20) AS year_max
            FROM articles
            WHERE COALESCE(WorkFormType_f, '') <> 'J'
              AND Date_of_Publication_F20 IS NOT NULL
            """
        )
    ).mappings().first()

    year_values = [
        periodical_years.get("year_min") if periodical_years else None,
        periodical_years.get("year_max") if periodical_years else None,
        nonperiodical_years.get("year_min") if nonperiodical_years else None,
        nonperiodical_years.get("year_max") if nonperiodical_years else None,
    ]
    years = [int(value) for value in year_values if value is not None]

    return EditionFiltersResponse(
        year_min=min(years) if years else None,
        year_max=max(years) if years else None,
        metric_levels=METRIC_LEVEL_OPTIONS,
        edition_types=EDITION_TYPE_OPTIONS,
    )
