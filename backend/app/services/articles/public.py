from __future__ import annotations

import math
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.article import (
    ArticleDetailResponse,
    ArticleFiltersResponse,
    ArticleListItem,
    ArticleListResponse,
    ArticleMetricItem,
    DatabaseOption,
    PaginationMeta,
    PublicationTypeOption,
    RelatedArticleItem,
)
from app.services.articles.exceptions import ArticleNotFoundError
from app.services.articles.bibliographic_reference import (
    build_bibliographic_reference,
    build_pages_fallback_select_sql,
)
from app.services.articles import pdf_files

DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100


DATABASE_OPTIONS: list[DatabaseOption] = [
    DatabaseOption(value="wos", label="Web of Science"),
    DatabaseOption(value="scopus", label="Scopus"),
    DatabaseOption(value="white_list", label="Белый список"),
    DatabaseOption(value="rinc", label="РИНЦ"),
    DatabaseOption(value="vak", label="ВАК"),
]

PUBLICATION_TYPE_OPTIONS: list[PublicationTypeOption] = [
    PublicationTypeOption(value="article", label="Статья"),
    PublicationTypeOption(value="conference", label="Конференция"),
    PublicationTypeOption(value="monograph", label="Монография"),
    PublicationTypeOption(value="chapter", label="Глава"),
    PublicationTypeOption(value="patent_method", label="Патент/методика"),
    PublicationTypeOption(value="other", label="Другое"),
]

PUBLICATION_TYPE_CATEGORY_FLAGS: dict[str, tuple[str, ...]] = {
    "article": ("ST",),
    "conference": ("MA", "DO", "PD", "SD", "TE", "TR"),
    "monograph": ("MO",),
    "chapter": ("GL",),
    "patent_method": ("PA", "MP", "AS", "LI"),
}

PUBLICATION_TYPE_PRIMARY_FLAGS: tuple[str, ...] = tuple(
    flag
    for flags in PUBLICATION_TYPE_CATEGORY_FLAGS.values()
    for flag in flags
)

SOURCE_TITLE_EXPR = """
    COALESCE(
        NULLIF(jn.JournalName, ''),
        NULLIF(j.jname, ''),
        NULLIF(a.Title_of_Material_F9, ''),
        NULLIF(a.Edition_F15, '')
    )
"""

SORT_FIELD_MAP = {
    "authors": """
        COALESCE(
            NULLIF(a.Author_Analitic_F1, ''),
            (
                SELECT GROUP_CONCAT(DISTINCT au.authorName ORDER BY au.authorName SEPARATOR ', ')
                FROM articlehasauthor aha
                JOIN authors au ON au.authorID = aha.authorID_f
                WHERE aha.Record_ID_f = a.Record_ID
            )
        )
    """,
    "title": "a.Title_Analitic_F4",
    "journal": SOURCE_TITLE_EXPR,
    "year": "a.Date_of_Publication_F20",
    "doi": "a.DOI",
    "quartile": "COALESCE(NULLIF(j.Quartile, ''), NULLIF(j.QuartileScopus, ''))",
}

QUARTILE_SORT_VALUE = "UPPER(TRIM(COALESCE(NULLIF(j.Quartile, ''), NULLIF(j.QuartileScopus, ''))))"

QUARTILE_SORT_RANK = f"""
    CASE {QUARTILE_SORT_VALUE}
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


def _build_in_clause(prefix: str, values: list[str], params: dict[str, Any]) -> str:
    placeholders: list[str] = []

    for index, value in enumerate(values):
        key = f"{prefix}_{index}"
        placeholders.append(f":{key}")
        params[key] = value

    return ", ".join(placeholders)


def _normalize_str_list(values: list[str] | None) -> list[str]:
    if not values:
        return []

    normalized: list[str] = []
    for value in values:
        stripped = value.strip()
        if stripped:
            normalized.append(stripped)

    return normalized


def _parse_keyword_terms(value: str | list[str] | None) -> list[str]:
    if not value:
        return []

    terms: list[str] = []
    seen_terms: set[str] = set()
    raw_values = value if isinstance(value, list) else [value]

    for raw_value in raw_values:
        for raw_term in raw_value.replace(";", ",").replace("\n", ",").split(","):
            term = raw_term.strip()
            if not term:
                continue

            normalized_term = term.lower()
            if normalized_term in seen_terms:
                continue

            seen_terms.add(normalized_term)
            terms.append(term)

    return terms


def _build_publication_type_condition(
    publication_types: list[str],
    params: dict[str, Any],
) -> str | None:
    category_conditions: list[str] = []
    direct_values: list[str] = []

    for publication_type in publication_types:
        value = publication_type.strip()
        if not value:
            continue

        flags = PUBLICATION_TYPE_CATEGORY_FLAGS.get(value)
        if flags:
            in_clause = _build_in_clause(
                f"pub_type_{value}",
                list(flags),
                params,
            )
            category_conditions.append(f"aht.TypeOfPublication_f IN ({in_clause})")
            continue

        if value == "other":
            in_clause = _build_in_clause(
                "pub_type_primary",
                list(PUBLICATION_TYPE_PRIMARY_FLAGS),
                params,
            )
            category_conditions.append(f"aht.TypeOfPublication_f NOT IN ({in_clause})")
            continue

        direct_values.append(value)

    if direct_values:
        in_clause = _build_in_clause("pub_type_direct", direct_values, params)
        category_conditions.append(
            f"(top.TOP_Flag IN ({in_clause}) OR top.TOP_Name IN ({in_clause}))"
        )

    if not category_conditions:
        return None

    return (
        """
        EXISTS (
            SELECT 1
            FROM articlehastop aht
            JOIN typesofpublications top
              ON top.TOP_Flag = aht.TypeOfPublication_f
            WHERE aht.Record_ID_f = a.Record_ID
              AND (
        """
        + " OR ".join(f"({condition})" for condition in category_conditions)
        + """
              )
        )
        """
    )


def _extract_databases(row: dict[str, Any]) -> list[str]:
    items: list[str] = []

    if row.get("wos_flag"):
        items.append("Web of Science")
    if row.get("scopus_flag"):
        items.append("Scopus")
    if row.get("white_list_flag"):
        items.append("Белый список")
    if row.get("rinc_flag"):
        items.append("РИНЦ")
    if row.get("rinc_core_flag"):
        items.append("Ядро РИНЦ")
    if row.get("rsci_flag"):
        items.append("RSCI")
    if row.get("vak_flag"):
        items.append("ВАК")

    return items


def _parse_csv_list(value: str | None) -> list[str]:
    if not value:
        return []

    return [item.strip() for item in value.split("|||") if item.strip()]


def _build_common_filters(
    params: dict[str, Any],
    title: str | None,
    author: str | None,
    journal: str | None,
    keyword: str | list[str] | None,
    year_from: int | None,
    year_to: int | None,
    publication_types: list[str],
    databases: list[str],
    original_translation_mode: str,
) -> str:
    conditions: list[str] = []

    if title and title.strip():
        params["title"] = f"%{title.strip()}%"
        conditions.append(
            """
            (
                a.Title_Analitic_F4 LIKE :title
                OR a.DOI LIKE :title
            )
            """
        )

    if author and author.strip():
        params["author"] = f"%{author.strip()}%"
        conditions.append(
            """
            (
                a.Author_Analitic_F1 LIKE :author
                OR EXISTS (
                    SELECT 1
                    FROM articlehasauthor aha
                    JOIN authors au ON au.authorID = aha.authorID_f
                    WHERE aha.Record_ID_f = a.Record_ID
                      AND au.authorName LIKE :author
                )
            )
            """
        )

    if journal and journal.strip():
        params["journal"] = f"%{journal.strip()}%"
        conditions.append(
            f"""
            (
                {SOURCE_TITLE_EXPR} LIKE :journal
                OR a.ISSN_F40 LIKE :journal
                OR a.ISBN_F41 LIKE :journal
            )
            """
        )

    keyword_terms = _parse_keyword_terms(keyword)
    for index, keyword_term in enumerate(keyword_terms):
        param_name = f"keyword_{index}"
        params[param_name] = f"%{keyword_term}%"
        conditions.append(
            f"""
            EXISTS (
                SELECT 1
                FROM articlehaskeywords ahk
                JOIN keywords k ON k.K_ID = ahk.Keyword_ID_f
                WHERE ahk.Record_ID_f = a.Record_ID
                  AND k.Keyword LIKE :{param_name}
            )
            """
        )

    if year_from is not None:
        params["year_from"] = year_from
        conditions.append("a.Date_of_Publication_F20 >= :year_from")

    if year_to is not None:
        params["year_to"] = year_to
        conditions.append("a.Date_of_Publication_F20 <= :year_to")

    if publication_types:
        publication_type_condition = _build_publication_type_condition(
            publication_types,
            params,
        )
        if publication_type_condition:
            conditions.append(publication_type_condition)

    if databases:
        db_conditions: list[str] = []

        for database in databases:
            value = database.strip().lower()

            if value == "wos":
                db_conditions.append("COALESCE(j.WOS, 0) = 1")
            elif value == "scopus":
                db_conditions.append("COALESCE(j.Scopus, 0) = 1")
            elif value == "white_list":
                db_conditions.append("COALESCE(j.LWL, 0) = 1")
            elif value == "rinc":
                db_conditions.append("COALESCE(j.Rints, 0) = 1")
            elif value == "rinc_core":
                db_conditions.append("COALESCE(j.RintsCore, 0) = 1")
            elif value == "rsci":
                db_conditions.append("COALESCE(j.RSCI, 0) = 1")
            elif value == "vak":
                db_conditions.append("COALESCE(j.BAK, 0) = 1")

        if db_conditions:
            conditions.append("(" + " OR ".join(db_conditions) + ")")

    if original_translation_mode == "original_only":
        conditions.append(
            """
            NOT (
                jaa.OriginalVer_ID_f IS NOT NULL
                OR EXISTS (
                    SELECT 1
                    FROM journalarticlesattributes relation
                    WHERE relation.PerVer_ID_f = a.Record_ID
                )
            )
            """
        )
    elif original_translation_mode == "translation_only":
        conditions.append(
            """
            NOT (
                jaa.PerVer_ID_f IS NOT NULL
                OR EXISTS (
                    SELECT 1
                    FROM journalarticlesattributes relation
                    WHERE relation.OriginalVer_ID_f = a.Record_ID
                )
            )
            """
        )

    if not conditions:
        return ""

    return "\nAND " + "\nAND ".join(f"({condition.strip()})" for condition in conditions)


def _build_metrics(row: dict[str, Any]) -> list[ArticleMetricItem]:
    white_list_enabled = bool(row.get("white_list_flag"))
    white_list_extra = None
    if white_list_enabled and row.get("rinc_core_flag"):
        white_list_extra = "УБС 1"

    metrics = [
        ArticleMetricItem(
            label="«Белый список»",
            value="Да" if white_list_enabled else None,
            extra=white_list_extra,
            enabled=white_list_enabled,
        ),
        ArticleMetricItem(
            label="Web of Science",
            value=row.get("quartile") if row.get("wos_flag") else None,
            enabled=bool(row.get("wos_flag")),
        ),
        ArticleMetricItem(
            label="Scopus",
            value=row.get("quartile_scopus") if row.get("scopus_flag") else None,
            enabled=bool(row.get("scopus_flag")),
        ),
        ArticleMetricItem(
            label="РИНЦ",
            value="Да" if row.get("rinc_flag") else None,
            extra="core" if row.get("rinc_core_flag") else None,
            enabled=bool(row.get("rinc_flag")),
        ),
        ArticleMetricItem(
            label="ВАК",
            value="Да" if row.get("vak_flag") else None,
            enabled=bool(row.get("vak_flag")),
        ),
    ]

    return metrics


def _fetch_related_articles(db: Session, article_id: int) -> list[RelatedArticleItem]:
    relation_rows = db.execute(
        text(
            """
            SELECT
                jaa.Record_ID_f,
                jaa.OriginalVer_ID_f,
                jaa.PerVer_ID_f
            FROM journalarticlesattributes jaa
            WHERE jaa.Record_ID_f = :article_id
               OR jaa.OriginalVer_ID_f = :article_id
               OR jaa.PerVer_ID_f = :article_id
            """
        ),
        {"article_id": article_id},
    ).mappings().all()

    related_map: dict[int, str] = {}

    for row in relation_rows:
        record_id = row.get("Record_ID_f")
        original_id = row.get("OriginalVer_ID_f")
        translation_id = row.get("PerVer_ID_f")

        if record_id == article_id:
            if original_id:
                related_map[int(original_id)] = "original"
            if translation_id:
                related_map[int(translation_id)] = "translation"

        if original_id == article_id and record_id:
            related_map[int(record_id)] = "translation"

        if translation_id == article_id and record_id:
            related_map[int(record_id)] = "original"

    if not related_map:
        return []

    related_ids = list(related_map.keys())
    placeholders = ", ".join(f":related_id_{index}" for index in range(len(related_ids)))
    params: dict[str, Any] = {
        f"related_id_{index}": value for index, value in enumerate(related_ids)
    }

    related_rows = db.execute(
        text(
            f"""
            SELECT
                a.Record_ID AS id,
                a.Title_Analitic_F4 AS title,
                COALESCE(
                    NULLIF(a.Author_Analitic_F1, ''),
                    (
                        SELECT GROUP_CONCAT(DISTINCT au.authorName ORDER BY au.authorName SEPARATOR ', ')
                        FROM articlehasauthor aha
                        JOIN authors au ON au.authorID = aha.authorID_f
                        WHERE aha.Record_ID_f = a.Record_ID
                    )
                ) AS authors,
                {SOURCE_TITLE_EXPR} AS journal,
                a.Date_of_Publication_F20 AS year,
                a.DOI AS doi
            FROM articles a
            LEFT JOIN journals j ON j.J_ID = a.Journal_ID_f
            LEFT JOIN journalnames jn ON jn.JN_ID = j.JN_ID_f
            WHERE a.Record_ID IN ({placeholders})
            """
        ),
        params,
    ).mappings().all()

    items: list[RelatedArticleItem] = []

    for row in related_rows:
        relation_type = related_map.get(int(row["id"]))
        if relation_type is None:
            continue

        items.append(
            RelatedArticleItem(
                id=row["id"],
                title=row.get("title"),
                authors=row.get("authors"),
                journal=row.get("journal"),
                year=row.get("year"),
                doi=row.get("doi"),
                relation_type=relation_type,
                has_pdf=pdf_files.article_pdf_exists(row["id"]),
            )
        )

    items.sort(key=lambda item: (0 if item.relation_type == "original" else 1, item.id))
    return items


def list_articles(
    db: Session,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    title: str | None = None,
    author: str | None = None,
    journal: str | None = None,
    keyword: str | list[str] | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    publication_types: list[str] | None = None,
    databases: list[str] | None = None,
    original_translation_mode: str = "all",
    sort_by: str = "year",
    sort_order: str = "desc",
    include_total: bool = True,
    known_total: int | None = None,
) -> ArticleListResponse:
    publication_types = _normalize_str_list(publication_types)
    databases = _normalize_str_list(databases)

    sort_by = (sort_by or "year").lower()
    sort_order = (sort_order or "desc").lower()

    sort_expr = SORT_FIELD_MAP.get(sort_by, SORT_FIELD_MAP["year"])
    sort_dir = "ASC" if sort_order == "asc" else "DESC"
    order_by_sql = (
        f"{QUARTILE_SORT_RANK} {sort_dir}, a.Record_ID DESC"
        if sort_by == "quartile"
        else f"{sort_expr} {sort_dir}, a.Record_ID DESC"
    )

    params: dict[str, Any] = {}
    filters_sql = _build_common_filters(
        params=params,
        title=title,
        author=author,
        journal=journal,
        keyword=keyword,
        year_from=year_from,
        year_to=year_to,
        publication_types=publication_types,
        databases=databases,
        original_translation_mode=original_translation_mode,
    )

    if include_total or known_total is None:
        count_query = text(
            f"""
            SELECT COUNT(DISTINCT a.Record_ID) AS total
            FROM articles a
            LEFT JOIN journals j ON j.J_ID = a.Journal_ID_f
            LEFT JOIN journalnames jn ON jn.JN_ID = j.JN_ID_f
            LEFT JOIN journalarticlesattributes jaa ON jaa.Record_ID_f = a.Record_ID
            WHERE 1 = 1
            {filters_sql}
            """
        )

        total = int(db.execute(count_query, params).scalar() or 0)
    else:
        total = known_total

    offset = (page - 1) * page_size
    page_params = dict(params)
    page_params["limit"] = page_size
    page_params["offset"] = offset

    id_query = text(
        f"""
        SELECT a.Record_ID AS id
        FROM articles a
        LEFT JOIN journals j ON j.J_ID = a.Journal_ID_f
        LEFT JOIN journalnames jn ON jn.JN_ID = j.JN_ID_f
        LEFT JOIN journalarticlesattributes jaa ON jaa.Record_ID_f = a.Record_ID
        WHERE 1 = 1
        {filters_sql}
        ORDER BY {order_by_sql}
        LIMIT :limit OFFSET :offset
        """
    )

    id_rows = db.execute(id_query, page_params).mappings().all()
    article_ids = [int(row["id"]) for row in id_rows]

    if not article_ids:
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        return ArticleListResponse(
            items=[],
            pagination=PaginationMeta(
                page=page,
                page_size=page_size,
                total=total,
                total_pages=total_pages,
            ),
        )

    id_placeholders = ", ".join(
        f":article_id_{index}" for index in range(len(article_ids))
    )
    order_placeholders = ", ".join(
        f":article_id_{index}" for index in range(len(article_ids))
    )
    data_params: dict[str, Any] = {
        f"article_id_{index}": article_id
        for index, article_id in enumerate(article_ids)
    }
    pages_fallback_sql = build_pages_fallback_select_sql(db)

    data_query = text(
        f"""
        SELECT
            a.Record_ID AS id,
            a.Record_ID AS record_id,
            a.WorkFormType_f AS work_form_type,
            a.Author_Analitic_F1 AS author_analitic,
            a.Title_Analitic_F4 AS title,
            a.Title_Analitic_F4 AS title_analitic,
            a.Author_of_Material_F7 AS author_of_material,
            a.Title_of_Material_F9 AS title_of_material,
            a.DateOfMeeting_F12 AS date_of_meeting,
            a.Edition_F15 AS edition,
            a.Date_of_Publication_F20 AS date_of_publication,
            a.VolumeID_F22 AS volume,
            a.IssueID_F24 AS issue,
            a.Pages_F25 AS pages,
            {pages_fallback_sql} AS pages_fallback,
            a.ExtentOfWork_F26 AS extent_of_work,
            a.ISBN_F41 AS isbn,
            COALESCE(
                NULLIF(a.Author_Analitic_F1, ''),
                (
                    SELECT GROUP_CONCAT(DISTINCT au.authorName ORDER BY au.authorName SEPARATOR ', ')
                    FROM articlehasauthor aha
                    JOIN authors au ON au.authorID = aha.authorID_f
                    WHERE aha.Record_ID_f = a.Record_ID
                )
            ) AS authors,
            NULLIF(jn.JournalName, '') AS journal_name,
            {SOURCE_TITLE_EXPR} AS journal,
            a.Date_of_Publication_F20 AS year,
            a.DOI AS doi,
            pp.PlaceName AS place_name,
            pn.PublisherName AS publisher_name,
            NULLIF(j.Quartile, '') AS quartile,
            NULLIF(j.QuartileScopus, '') AS quartile_scopus,
            COALESCE(j.WOS, 0) AS wos_flag,
            COALESCE(j.Scopus, 0) AS scopus_flag,
            COALESCE(j.LWL, 0) AS white_list_flag,
            COALESCE(j.Rints, 0) AS rinc_flag,
            COALESCE(j.RintsCore, 0) AS rinc_core_flag,
            COALESCE(j.RSCI, 0) AS rsci_flag,
            COALESCE(j.BAK, 0) AS vak_flag,
            (
                SELECT GROUP_CONCAT(DISTINCT top.TOP_Name ORDER BY top.TOP_Name SEPARATOR '|||')
                FROM articlehastop aht
                JOIN typesofpublications top
                  ON top.TOP_Flag = aht.TypeOfPublication_f
                WHERE aht.Record_ID_f = a.Record_ID
            ) AS publication_types_csv,
            CASE
                WHEN jaa.OriginalVer_ID_f IS NOT NULL
                    OR EXISTS (
                        SELECT 1
                        FROM journalarticlesattributes relation
                        WHERE relation.PerVer_ID_f = a.Record_ID
                    )
                THEN 'translation'
                WHEN jaa.PerVer_ID_f IS NOT NULL
                    OR EXISTS (
                        SELECT 1
                        FROM journalarticlesattributes relation
                        WHERE relation.OriginalVer_ID_f = a.Record_ID
                    )
                THEN 'original'
                ELSE NULL
            END AS original_translation
        FROM articles a
        LEFT JOIN journals j ON j.J_ID = a.Journal_ID_f
        LEFT JOIN journalnames jn ON jn.JN_ID = j.JN_ID_f
        LEFT JOIN journalarticlesattributes jaa ON jaa.Record_ID_f = a.Record_ID
        LEFT JOIN places pp ON pp.P_ID = a.PlaceOfPublication_F18_f
        LEFT JOIN publishernames pn ON pn.PN_ID = a.PublisherName_F19_f
        WHERE a.Record_ID IN ({id_placeholders})
        ORDER BY FIELD(a.Record_ID, {order_placeholders})
        """
    )

    rows = db.execute(data_query, data_params).mappings().all()

    items: list[ArticleListItem] = []
    for row in rows:
        row_dict = dict(row)

        items.append(
            ArticleListItem(
                id=row_dict["id"],
                title=row_dict.get("title"),
                authors=row_dict.get("authors"),
                journal=row_dict.get("journal"),
                year=row_dict.get("year"),
                doi=row_dict.get("doi"),
                bibliographic_reference=build_bibliographic_reference(row_dict),
                quartile=row_dict.get("quartile"),
                quartile_scopus=row_dict.get("quartile_scopus"),
                publication_types=_parse_csv_list(row_dict.get("publication_types_csv")),
                databases=_extract_databases(row_dict),
                original_translation=row_dict.get("original_translation"),
                has_pdf=pdf_files.article_pdf_exists(row_dict["id"]),
            )
        )

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return ArticleListResponse(
        items=items,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


def get_article_filters(db: Session) -> ArticleFiltersResponse:
    years_row = db.execute(
        text(
            """
            SELECT
                MIN(Date_of_Publication_F20) AS year_min,
                MAX(Date_of_Publication_F20) AS year_max
            FROM articles
            WHERE Date_of_Publication_F20 IS NOT NULL
            """
        )
    ).mappings().first()

    return ArticleFiltersResponse(
        year_min=years_row["year_min"] if years_row else None,
        year_max=years_row["year_max"] if years_row else None,
        publication_types=PUBLICATION_TYPE_OPTIONS,
        databases=DATABASE_OPTIONS,
        original_translation_modes=[
            {"value": "all", "label": "Все"},
            {"value": "original_only", "label": "Только оригиналы"},
            {"value": "translation_only", "label": "Только переводы"},
        ],
    )


def get_latest_articles(
    db: Session,
    limit: int = 5,
):
    query = text(
        f"""
        SELECT
            a.Record_ID AS id,
            a.Title_Analitic_F4 AS title,
            COALESCE(
                NULLIF(a.Author_Analitic_F1, ''),
                (
                    SELECT GROUP_CONCAT(DISTINCT au.authorName ORDER BY au.authorName SEPARATOR ', ')
                    FROM articlehasauthor aha
                    JOIN authors au ON au.authorID = aha.authorID_f
                    WHERE aha.Record_ID_f = a.Record_ID
                )
            ) AS authors,
            {SOURCE_TITLE_EXPR} AS journal,
            a.Date_of_Publication_F20 AS year,
            a.DOI AS doi
        FROM (
            SELECT Record_ID
            FROM articles
            ORDER BY InsertDate DESC, Record_ID DESC
            LIMIT :limit
        ) latest
        JOIN articles a ON a.Record_ID = latest.Record_ID
        LEFT JOIN journals j ON j.J_ID = a.Journal_ID_f
        LEFT JOIN journalnames jn ON jn.JN_ID = j.JN_ID_f
        ORDER BY a.InsertDate DESC, a.Record_ID DESC
        """
    )

    rows = db.execute(query, {"limit": limit}).mappings().all()
    return list(rows)


def get_article_detail(
    article_id: int,
    db: Session,
) -> ArticleDetailResponse:
    pages_fallback_sql = build_pages_fallback_select_sql(db)
    article_row = db.execute(
        text(
            f"""
            SELECT
                a.Record_ID AS id,
                a.Record_ID AS record_id,
                a.WorkFormType_f AS work_form_type,
                a.Author_Analitic_F1 AS author_analitic,
                a.Title_Analitic_F4 AS title,
                a.Title_Analitic_F4 AS title_analitic,
                a.Author_of_Material_F7 AS author_of_material,
                a.Title_of_Material_F9 AS title_of_material,
                a.DateOfMeeting_F12 AS date_of_meeting,
                a.Edition_F15 AS edition,
                a.Date_of_Publication_F20 AS date_of_publication,
                a.ExtentOfWork_F26 AS extent_of_work,
                a.ISBN_F41 AS isbn,
                a.Author_Analitic_F1 AS authors_fallback,
                a.Abstract_F43 AS abstract,
                a.DOI AS doi,
                a.VolumeID_F22 AS volume,
                a.IssueID_F24 AS issue,
                a.Pages_F25 AS pages,
                {pages_fallback_sql} AS pages_fallback,
                a.PublicationDate AS publication_date,
                a.Date_of_Publication_F20 AS year,
                a.InsertDate AS insert_date,
                NULLIF(jn.JournalName, '') AS journal_name,
                {SOURCE_TITLE_EXPR} AS journal,
                CASE
                    WHEN jn.JN_ID IS NOT NULL THEN 'periodical'
                    WHEN COALESCE(a.WorkFormType_f, '') <> 'J' THEN 'nonperiodical'
                    ELSE NULL
                END AS edition_kind,
                CASE
                    WHEN jn.JN_ID IS NOT NULL THEN jn.JN_ID
                    WHEN COALESCE(a.WorkFormType_f, '') <> 'J' THEN a.Record_ID
                    ELSE NULL
                END AS edition_source_id,
                pp.PlaceName AS place_name,
                pn.PublisherName AS publisher_name,
                NULLIF(j.Quartile, '') AS quartile,
                NULLIF(j.QuartileScopus, '') AS quartile_scopus,
                COALESCE(j.WOS, 0) AS wos_flag,
                COALESCE(j.Scopus, 0) AS scopus_flag,
                COALESCE(j.LWL, 0) AS white_list_flag,
                COALESCE(j.Rints, 0) AS rinc_flag,
                COALESCE(j.RintsCore, 0) AS rinc_core_flag,
                COALESCE(j.RSCI, 0) AS rsci_flag,
                COALESCE(j.BAK, 0) AS vak_flag
            FROM articles a
            LEFT JOIN journals j ON j.J_ID = a.Journal_ID_f
            LEFT JOIN journalnames jn ON jn.JN_ID = j.JN_ID_f
            LEFT JOIN journalarticlesattributes jaa ON jaa.Record_ID_f = a.Record_ID
            LEFT JOIN places pp ON pp.P_ID = a.PlaceOfPublication_F18_f
            LEFT JOIN publishernames pn ON pn.PN_ID = a.PublisherName_F19_f
            WHERE a.Record_ID = :article_id
            """
        ),
        {"article_id": article_id},
    ).mappings().first()

    if article_row is None:
        raise ArticleNotFoundError("Публикация не найдена.")

    authors_row = db.execute(
        text(
            """
            SELECT
                GROUP_CONCAT(au.authorName ORDER BY aha.AHA_ID SEPARATOR ', ') AS authors
            FROM articlehasauthor aha
            JOIN authors au ON au.authorID = aha.authorID_f
            WHERE aha.Record_ID_f = :article_id
            """
        ),
        {"article_id": article_id},
    ).mappings().first()

    keywords_rows = db.execute(
        text(
            """
            SELECT
                k.Keyword AS keyword
            FROM articlehaskeywords ahk
            JOIN keywords k ON k.K_ID = ahk.Keyword_ID_f
            WHERE ahk.Record_ID_f = :article_id
            ORDER BY k.Keyword
            """
        ),
        {"article_id": article_id},
    ).mappings().all()

    publication_type_rows = db.execute(
        text(
            """
            SELECT
                top.TOP_Name AS label
            FROM articlehastop aht
            JOIN typesofpublications top ON top.TOP_Flag = aht.TypeOfPublication_f
            WHERE aht.Record_ID_f = :article_id
            ORDER BY top.TOP_Name
            """
        ),
        {"article_id": article_id},
    ).mappings().all()

    related_articles = _fetch_related_articles(db, article_id)

    article_dict = dict(article_row)
    authors = None

    if article_dict.get("authors_fallback"):
        authors = article_dict.get("authors_fallback")
    elif authors_row and authors_row.get("authors"):
        authors = authors_row.get("authors")

    return ArticleDetailResponse(
        id=article_dict["id"],
        title=article_dict.get("title"),
        authors=authors,
        abstract=article_dict.get("abstract"),
        doi=article_dict.get("doi"),
        bibliographic_reference=build_bibliographic_reference(article_dict),
        journal=article_dict.get("journal"),
        edition_kind=article_dict.get("edition_kind"),
        edition_source_id=article_dict.get("edition_source_id"),
        year=article_dict.get("year"),
        volume=article_dict.get("volume"),
        issue=article_dict.get("issue"),
        pages=article_dict.get("pages"),
        publication_date=(
            article_dict.get("publication_date").isoformat()
            if article_dict.get("publication_date")
            else None
        ),
        insert_date=(
            article_dict.get("insert_date").isoformat()
            if article_dict.get("insert_date")
            else None
        ),
        publication_types=[
            row["label"] for row in publication_type_rows if row.get("label")
        ],
        keywords=[
            row["keyword"] for row in keywords_rows if row.get("keyword")
        ],
        metrics=_build_metrics(article_dict),
        related_articles=related_articles,
        has_pdf=pdf_files.article_pdf_exists(article_id),
    )
