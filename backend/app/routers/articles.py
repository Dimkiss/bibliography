from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.article import (
    ArticleFiltersResponse,
    ArticleListItem,
    ArticleListResponse,
    DatabaseOption,
    PaginationMeta,
    PublicationTypeOption,
)

router = APIRouter(prefix="/articles", tags=["articles"])

DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100

DATABASE_OPTIONS: list[DatabaseOption] = [
    DatabaseOption(value="wos", label="Web of Science"),
    DatabaseOption(value="scopus", label="Scopus"),
    DatabaseOption(value="white_list", label="Белый список"),
    DatabaseOption(value="rinc", label="РИНЦ"),
    DatabaseOption(value="rinc_core", label="Ядро РИНЦ"),
    DatabaseOption(value="rsci", label="RSCI"),
    DatabaseOption(value="vak", label="ВАК"),
]


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
    keyword: str | None,
    year_from: int | None,
    year_to: int | None,
    publication_types: list[str],
    databases: list[str],
    original_translation_mode: str,
) -> str:
    conditions: list[str] = []

    if title and title.strip():
        params["title"] = f"%{title.strip()}%"
        conditions.append("a.Title_Analitic_F4 LIKE :title")

    if author and author.strip():
        params["author"] = f"%{author.strip()}%"
        conditions.append(
            """
            EXISTS (
                SELECT 1
                FROM articlehasauthor aha
                JOIN authors au ON au.authorID = aha.authorID_f
                WHERE aha.Record_ID_f = a.Record_ID
                  AND au.authorName LIKE :author
            )
            """
        )

    if journal and journal.strip():
        params["journal"] = f"%{journal.strip()}%"
        conditions.append(
            """
            COALESCE(NULLIF(jn.JournalName, ''), NULLIF(j.jname, ''), NULLIF(a.Edition_F15, ''))
            LIKE :journal
            """
        )

    if keyword and keyword.strip():
        params["keyword"] = f"%{keyword.strip()}%"
        conditions.append(
            """
            EXISTS (
                SELECT 1
                FROM articlehaskeywords ahk
                JOIN keywords k ON k.K_ID = ahk.Keyword_ID_f
                WHERE ahk.Record_ID_f = a.Record_ID
                  AND k.Keyword LIKE :keyword
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
        in_clause = _build_in_clause("pub_type", publication_types, params)
        conditions.append(
            f"""
            EXISTS (
                SELECT 1
                FROM articlehastop aht
                JOIN typesofpublications top
                  ON top.TOP_Flag = aht.TypeOfPublication_f
                WHERE aht.Record_ID_f = a.Record_ID
                  AND (top.TOP_Flag IN ({in_clause}) OR top.TOP_Name IN ({in_clause}))
            )
            """
        )

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
        conditions.append("jaa.PerVer_ID_f IS NOT NULL")
    elif original_translation_mode == "translation_only":
        conditions.append("jaa.OriginalVer_ID_f IS NOT NULL")
    elif original_translation_mode == "linked_only":
        conditions.append("(jaa.OriginalVer_ID_f IS NOT NULL OR jaa.PerVer_ID_f IS NOT NULL)")

    if not conditions:
        return ""

    return "\nAND " + "\nAND ".join(f"({condition.strip()})" for condition in conditions)


@router.get("", response_model=ArticleListResponse)
def list_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    title: str | None = Query(None),
    author: str | None = Query(None),
    journal: str | None = Query(None),
    keyword: str | None = Query(None),
    year_from: int | None = Query(None, ge=0),
    year_to: int | None = Query(None, ge=0),
    publication_types: list[str] | None = Query(None),
    databases: list[str] | None = Query(None),
    original_translation_mode: str = Query("all"),
    db: Session = Depends(get_db),
):
    publication_types = _normalize_str_list(publication_types)
    databases = _normalize_str_list(databases)

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

    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset

    data_query = text(
        f"""
        SELECT
            a.Record_ID AS id,
            a.Title_Analitic_F4 AS title,
            COALESCE(
                (
                    SELECT GROUP_CONCAT(DISTINCT au.authorName ORDER BY au.authorName SEPARATOR ', ')
                    FROM articlehasauthor aha
                    JOIN authors au ON au.authorID = aha.authorID_f
                    WHERE aha.Record_ID_f = a.Record_ID
                ),
                a.Author_Analitic_F1
            ) AS authors,
            COALESCE(NULLIF(jn.JournalName, ''), NULLIF(j.jname, ''), NULLIF(a.Edition_F15, '')) AS journal,
            a.Date_of_Publication_F20 AS year,
            a.DOI AS doi,
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
                WHEN jaa.OriginalVer_ID_f IS NOT NULL THEN 'translation'
                WHEN jaa.PerVer_ID_f IS NOT NULL THEN 'original'
                ELSE NULL
            END AS original_translation
        FROM articles a
        LEFT JOIN journals j ON j.J_ID = a.Journal_ID_f
        LEFT JOIN journalnames jn ON jn.JN_ID = j.JN_ID_f
        LEFT JOIN journalarticlesattributes jaa ON jaa.Record_ID_f = a.Record_ID
        WHERE 1 = 1
        {filters_sql}
        ORDER BY a.Date_of_Publication_F20 DESC, a.Record_ID DESC
        LIMIT :limit OFFSET :offset
        """
    )

    rows = db.execute(data_query, params).mappings().all()

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
                quartile=row_dict.get("quartile"),
                quartile_scopus=row_dict.get("quartile_scopus"),
                publication_types=_parse_csv_list(row_dict.get("publication_types_csv")),
                databases=_extract_databases(row_dict),
                original_translation=row_dict.get("original_translation"),
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


@router.get("/filters", response_model=ArticleFiltersResponse)
def get_article_filters(db: Session = Depends(get_db)):
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

    publication_type_rows = db.execute(
        text(
            """
            SELECT
                TOP_Flag AS value,
                TOP_Name AS label
            FROM typesofpublications
            ORDER BY
                CASE WHEN Priority IS NULL THEN 1 ELSE 0 END,
                Priority ASC,
                TOP_Name ASC
            """
        )
    ).mappings().all()

    return ArticleFiltersResponse(
        year_min=years_row["year_min"] if years_row else None,
        year_max=years_row["year_max"] if years_row else None,
        publication_types=[
            PublicationTypeOption(value=row["value"], label=row["label"])
            for row in publication_type_rows
        ],
        databases=DATABASE_OPTIONS,
        original_translation_modes=[
            {"value": "all", "label": "Все"},
            {"value": "original_only", "label": "Только оригиналы"},
            {"value": "translation_only", "label": "Только переводы"},
            {"value": "linked_only", "label": "Только связанные оригинал/перевод"},
        ],
    )


@router.get("/latest")
def get_latest_articles(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    query = text(
        """
        SELECT
            a.Record_ID AS id,
            a.Title_Analitic_F4 AS title,
            COALESCE(
                (
                    SELECT GROUP_CONCAT(DISTINCT au.authorName ORDER BY au.authorName SEPARATOR ', ')
                    FROM articlehasauthor aha
                    JOIN authors au ON au.authorID = aha.authorID_f
                    WHERE aha.Record_ID_f = a.Record_ID
                ),
                a.Author_Analitic_F1
            ) AS authors,
            COALESCE(NULLIF(jn.JournalName, ''), NULLIF(j.jname, ''), NULLIF(a.Edition_F15, '')) AS journal,
            a.Date_of_Publication_F20 AS year,
            a.DOI AS doi
        FROM articles a
        LEFT JOIN journals j ON j.J_ID = a.Journal_ID_f
        LEFT JOIN journalnames jn ON jn.JN_ID = j.JN_ID_f
        ORDER BY a.PublicationDate DESC, a.Record_ID DESC
        LIMIT :limit
        """
    )

    rows = db.execute(query, {"limit": limit}).mappings().all()
    return list(rows)