from __future__ import annotations

import math
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.article import PaginationMeta
from app.schemas.edition import (
    EditionFilterOption,
    EditionFiltersResponse,
    EditionListItem,
    EditionListResponse,
)

DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100

METRIC_LEVEL_OPTIONS: list[EditionFilterOption] = [
    EditionFilterOption(value="q1", label="Q1"),
    EditionFilterOption(value="q2", label="Q2"),
    EditionFilterOption(value="q3", label="Q3"),
    EditionFilterOption(value="q4", label="Q4"),
]

EDITION_TYPE_OPTIONS: list[EditionFilterOption] = [
    EditionFilterOption(value="monograph", label="Монография"),
    EditionFilterOption(value="book", label="Книга/сборник"),
    EditionFilterOption(value="chapter", label="Глава"),
    EditionFilterOption(value="conference", label="Материалы конференций"),
    EditionFilterOption(value="patent_method", label="Патент / Свидетельство"),
    EditionFilterOption(value="report", label="Доклад"),
    EditionFilterOption(value="dissertation", label="Диссертация"),
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


def _clean_display_text(value: str | None) -> str | None:
    normalized = (value or "").strip()

    while normalized.startswith("/"):
        normalized = normalized[1:].strip()

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
                    a.WorkFormType_f = 'B'
                    OR EXISTS (
                        SELECT 1
                        FROM articlehastop aht
                        WHERE aht.Record_ID_f = a.Record_ID
                          AND aht.TypeOfPublication_f IN ('KN', 'SB', 'AT', 'BU', 'SP', 'UC')
                    )
                )
                """
            )
        elif value == "chapter":
            conditions.append(
                """
                EXISTS (
                    SELECT 1
                    FROM articlehastop aht
                    WHERE aht.Record_ID_f = a.Record_ID
                      AND aht.TypeOfPublication_f = 'GL'
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

    if work_form_type == "M" or flags.intersection({"PA", "AS", "LI"}):
        return "Патент / Свидетельство"

    if flags.intersection({"MP"}):
        return "Методическое пособие"

    if flags.intersection({"OT"}) or work_form_type == "R":
        return "Доклад"

    if "MO" in flags and "GL" not in flags:
        return "Монография"

    if "GL" in flags:
        return "Глава"

    if flags.intersection({"MA", "DO", "PD", "SD", "TE", "TR"}) or work_form_type == "C":
        return "Материалы конференций"

    if flags.intersection({"DI", "AR"}) or work_form_type == "D":
        return "Диссертация"

    if "SB" in flags:
        return "Сборник"

    if flags.intersection({"KN", "AT", "BU", "SP", "UC"}) or work_form_type == "B":
        return "Книжное издание"

    return names[0] if names else "Другое"


def _derive_contributors_label(row: dict[str, Any], publication_type: str) -> str | None:
    if not row.get("contributors"):
        return None

    if publication_type == "Патент / Свидетельство":
        return "Авторы"

    if row.get("author_of_material"):
        return "Редакторы"

    return "Авторы"


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

    params["limit"] = page_size
    params["offset"] = (page - 1) * page_size

    rows = db.execute(
        text(
            f"""
            SELECT
                jn.JN_ID AS source_id,
                jn.JournalName AS title,
                NULLIF(jn.ISSN, '') AS identifier,
                j.Year AS year,
                NULLIF(CAST(j.LWL AS CHAR), '') AS white_list_level,
                NULLIF(j.Quartile, '') AS wos_quartile,
                NULLIF(j.QuartileScopus, '') AS scopus_quartile,
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
            WHERE 1 = 1
            {filters_sql}
            ORDER BY {sort_expr} {sort_dir}, jn.JournalName ASC, jn.JN_ID ASC
            LIMIT :limit OFFSET :offset
            """
        ),
        params,
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
) -> EditionListResponse:
    params: dict[str, Any] = {}
    filters_sql = _build_nonperiodical_filters(
        params=params,
        query=query,
        year_from=year_from,
        year_to=year_to,
        edition_types=edition_types,
    )

    total = int(
        db.execute(
            text(
                f"""
                SELECT COUNT(DISTINCT a.Record_ID) AS total
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

    sort_by = (sort_by or "title").lower()
    sort_order = (sort_order or "asc").lower()
    sort_dir = "ASC" if sort_order == "asc" else "DESC"
    sort_expr = NONPERIODICAL_SORT_FIELD_MAP.get(
        sort_by,
        NONPERIODICAL_SORT_FIELD_MAP["title"],
    )

    params["limit"] = page_size
    params["offset"] = (page - 1) * page_size

    rows = db.execute(
        text(
            f"""
            SELECT
                *
            FROM (
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
                WHERE 1 = 1
                {filters_sql}
            ) editions
            ORDER BY {sort_expr} {sort_dir}, source_id DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        params,
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
