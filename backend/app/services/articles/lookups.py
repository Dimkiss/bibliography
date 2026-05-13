from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.article import (
    AuthorOptionItem,
    AuthorOptionListResponse,
    DepartmentOptionItem,
    DepartmentOptionListResponse,
    JournalOptionItem,
    JournalOptionListResponse,
    KeywordOptionItem,
    KeywordOptionListResponse,
    MediumDesignatorOptionItem,
    MediumDesignatorOptionListResponse,
    PlaceOptionItem,
    PlaceOptionListResponse,
    PublicationTypeOption,
    PublisherOptionItem,
    PublisherOptionListResponse,
    WorkFormFieldItem,
    WorkFormTypeOption,
)
from app.services.articles.pagination import (
    apply_pagination_sql,
    build_pagination_meta,
)

MAX_PUBLICATION_AUTHOR_CANDIDATES = 100


def _split_publication_authors(value: str | None) -> list[str]:
    if not value:
        return []

    authors: list[str] = []
    seen: set[str] = set()

    for raw_author in value.replace(";", ",").split(","):
        author = raw_author.strip()
        if not author:
            continue

        lowered = author.lower()
        if lowered in seen:
            continue

        seen.add(lowered)
        authors.append(author)

    return authors


def _search_publication_author_names(
    db: Session,
    *,
    search: str,
    limit: int,
    excluded_labels: set[str],
) -> list[AuthorOptionItem]:
    stripped = search.strip()
    if not stripped:
        return []

    params = {"search": f"%{stripped}%"}
    rows = db.execute(
        text(
            """
            SELECT Author_Analitic_F1 AS authors_text
            FROM articles
            WHERE Author_Analitic_F1 LIKE :search
            UNION ALL
            SELECT Author_of_Material_F7 AS authors_text
            FROM articles
            WHERE Author_of_Material_F7 LIKE :search
            LIMIT 1000
            """
        ),
        params,
    ).mappings().all()

    items: list[AuthorOptionItem] = []
    seen = set(excluded_labels)
    normalized_search = stripped.lower()

    for row in rows:
        for author in _split_publication_authors(row.get("authors_text")):
            lowered_author = author.lower()
            if normalized_search not in lowered_author or lowered_author in seen:
                continue

            seen.add(lowered_author)
            items.append(
                AuthorOptionItem(
                    id=None,
                    label=author,
                    source="publication_author",
                )
            )

            if len(items) >= limit:
                return items

    return items


def list_article_authors(
    db: Session,
    *,
    search: str | None,
    page: int,
    page_size: int,
    all_items: bool,
) -> AuthorOptionListResponse:
    params: dict[str, Any] = {}
    where_sql = ""

    if search and search.strip():
        params["search"] = f"%{search.strip()}%"
        where_sql = """
        WHERE
            a.authorName LIKE :search
            OR a.nickname LIKE :search
            OR a.email LIKE :search
            OR a.position LIKE :search
            OR CAST(a.authorID AS CHAR) LIKE :search
            OR d.DepartmentName LIKE :search
        """

    total = int(
        db.execute(
            text(
                f"""
                SELECT COUNT(*) AS total
                FROM authors a
                LEFT JOIN departments d ON d.DepartmentCode = a.DepartmentCode
                {where_sql}
                """
            ),
            params,
        ).scalar()
        or 0
    )

    limit_sql = apply_pagination_sql(
        params=params,
        page=page,
        page_size=page_size,
        all_items=all_items,
    )

    employee_rows = db.execute(
        text(
            f"""
            SELECT
                a.authorID AS id,
                a.authorName AS label,
                a.nickname AS nickname,
                a.email AS email,
                a.position AS position,
                d.DepartmentCode AS department_id,
                d.DepartmentName AS department_name
            FROM authors a
            LEFT JOIN departments d ON d.DepartmentCode = a.DepartmentCode
            {where_sql}
            ORDER BY a.authorName ASC, a.authorID ASC
            {limit_sql}
            """
        ),
        params,
    ).mappings().all()

    employee_items = [
        AuthorOptionItem(
            id=int(row["id"]),
            label=row["label"],
            source="employee",
            nickname=row.get("nickname"),
            email=row.get("email"),
            position=row.get("position"),
            department_id=row.get("department_id"),
            department_name=row.get("department_name"),
        )
        for row in employee_rows
    ]

    if search and search.strip():
        publication_author_items = _search_publication_author_names(
            db,
            search=search,
            limit=MAX_PUBLICATION_AUTHOR_CANDIDATES,
            excluded_labels=set(),
        )
        publication_author_labels = {item.label.lower() for item in publication_author_items}
        employee_items = [
            item for item in employee_items if item.label.lower() not in publication_author_labels
        ]
        items = [*publication_author_items, *employee_items][:page_size]
    else:
        items = employee_items

    return AuthorOptionListResponse(
        items=items,
        pagination=build_pagination_meta(
            total=total,
            page=page,
            page_size=page_size,
            all_items=all_items,
        ),
    )


def list_journals(
    db: Session,
    *,
    search: str | None,
    page: int,
    page_size: int,
    all_items: bool,
    include_total: bool = True,
) -> JournalOptionListResponse:
    params: dict[str, Any] = {}
    where_sql = ""

    if search and search.strip():
        params["search"] = f"%{search.strip()}%"
        where_sql = """
        WHERE
            COALESCE(NULLIF(jn.JournalName, ''), NULLIF(j.jname, '')) LIKE :search
            OR EXISTS (
                SELECT 1
                FROM journalsinonims js
                WHERE js.JN_ID_f = j.JN_ID_f
                  AND js.Sinonim LIKE :search
            )
            OR CAST(j.J_ID AS CHAR) LIKE :search
        """

    total = 0
    if include_total:
        total = int(
            db.execute(
                text(
                    f"""
                    SELECT COUNT(*) AS total
                    FROM journals j
                    LEFT JOIN journalnames jn ON jn.JN_ID = j.JN_ID_f
                    {where_sql}
                    """
                ),
                params,
            ).scalar()
            or 0
        )

    limit_sql = apply_pagination_sql(
        params=params,
        page=page,
        page_size=page_size,
        all_items=all_items,
    )

    rows = db.execute(
        text(
            f"""
            SELECT
                j.J_ID AS id,
                COALESCE(NULLIF(jn.JournalName, ''), NULLIF(j.jname, '')) AS journal_name,
                j.Year AS year,
                NULLIF(j.Quartile, '') AS quartile,
                NULLIF(j.QuartileScopus, '') AS quartile_scopus
            FROM journals j
            LEFT JOIN journalnames jn ON jn.JN_ID = j.JN_ID_f
            {where_sql}
            ORDER BY
                COALESCE(NULLIF(jn.JournalName, ''), NULLIF(j.jname, '')) ASC,
                j.Year DESC,
                j.J_ID DESC
            {limit_sql}
            """
        ),
        params,
    ).mappings().all()

    items = [
        JournalOptionItem(
            id=int(row["id"]),
            label=(
                f"{row['journal_name']} В· {row['year']}"
                if row.get("journal_name") and row.get("year")
                else (row.get("journal_name") or f"Р–СѓСЂРЅР°Р» #{row['id']}")
            ),
            journal_name=row.get("journal_name"),
            year=row.get("year"),
            quartile=row.get("quartile"),
            quartile_scopus=row.get("quartile_scopus"),
        )
        for row in rows
    ]

    return JournalOptionListResponse(
        items=items,
        pagination=build_pagination_meta(
            total=total if include_total else len(items),
            page=page,
            page_size=page_size,
            all_items=all_items,
        ),
    )


def list_publication_types(
    db: Session,
    *,
    work_form_type: str | None,
) -> list[PublicationTypeOption]:
    params: dict[str, Any] = {}
    join_sql = ""
    where_sql = ""

    if work_form_type and work_form_type.strip():
        params["work_form_type"] = work_form_type.strip()
        join_sql = """
        LEFT JOIN tophasworkformtype twft
          ON twft.TOP_Flag_f = top.TOP_Flag
        """
        where_sql = """
        WHERE twft.WorkformFlag_f = :work_form_type
        """

    rows = db.execute(
        text(
            f"""
            SELECT DISTINCT
                top.TOP_Flag AS value,
                top.TOP_Name AS label,
                top.Priority AS priority
            FROM typesofpublications top
            {join_sql}
            {where_sql}
            ORDER BY
                CASE WHEN top.Priority IS NULL THEN 1 ELSE 0 END,
                top.Priority ASC,
                top.TOP_Name ASC
            """
        ),
        params,
    ).mappings().all()

    if not rows and work_form_type:
        rows = db.execute(
            text(
                """
                SELECT
                    TOP_Flag AS value,
                    TOP_Name AS label,
                    Priority AS priority
                FROM typesofpublications
                ORDER BY
                    CASE WHEN Priority IS NULL THEN 1 ELSE 0 END,
                    Priority ASC,
                    TOP_Name ASC
                """
            )
        ).mappings().all()

    return [
        PublicationTypeOption(value=row["value"], label=row["label"])
        for row in rows
    ]


def list_work_form_types(db: Session) -> list[WorkFormTypeOption]:
    rows = db.execute(
        text(
            """
            SELECT
                WorkformFlag AS value,
                WorkFormName AS label,
                WorkFormNameRus AS label_ru
            FROM workformstypes
            ORDER BY WorkformFlag ASC
            """
        )
    ).mappings().all()

    return [
        WorkFormTypeOption(
            value=row["value"],
            label=row.get("label"),
            label_ru=row.get("label_ru"),
        )
        for row in rows
    ]


def list_work_form_fields(
    db: Session,
    *,
    work_form_type: str,
) -> list[WorkFormFieldItem]:
    rows = db.execute(
        text(
            """
            SELECT
                ArticleField AS article_field,
                NameRus AS label,
                ForeignTableName AS foreign_table_name,
                FieldHeight AS field_height,
                NotInArticlesField AS not_in_articles_field
            FROM workformsfields
            WHERE WorkFormType_f = :work_form_type
            ORDER BY WFC_ID ASC
            """
        ),
        {"work_form_type": work_form_type},
    ).mappings().all()

    return [
        WorkFormFieldItem(
            article_field=row.get("article_field"),
            label=row.get("label"),
            foreign_table_name=row.get("foreign_table_name"),
            field_height=row.get("field_height"),
            not_in_articles_field=bool(row.get("not_in_articles_field")),
        )
        for row in rows
    ]


def list_keywords(
    db: Session,
    *,
    search: str | None,
    page: int,
    page_size: int,
    all_items: bool,
) -> KeywordOptionListResponse:
    params: dict[str, Any] = {}
    where_sql = ""

    if search and search.strip():
        params["search"] = f"%{search.strip()}%"
        where_sql = "WHERE Keyword LIKE :search"

    total = int(
        db.execute(
            text(
                f"""
                SELECT COUNT(*) AS total
                FROM keywords
                {where_sql}
                """
            ),
            params,
        ).scalar()
        or 0
    )

    limit_sql = apply_pagination_sql(
        params=params,
        page=page,
        page_size=page_size,
        all_items=all_items,
    )

    rows = db.execute(
        text(
            f"""
            SELECT
                K_ID AS id,
                Keyword AS label
            FROM keywords
            {where_sql}
            ORDER BY Keyword ASC
            {limit_sql}
            """
        ),
        params,
    ).mappings().all()

    items = [
        KeywordOptionItem(id=int(row["id"]), label=row["label"])
        for row in rows
    ]

    return KeywordOptionListResponse(
        items=items,
        pagination=build_pagination_meta(
            total=total,
            page=page,
            page_size=page_size,
            all_items=all_items,
        ),
    )


def list_places(
    db: Session,
    *,
    search: str | None,
    page: int,
    page_size: int,
    all_items: bool,
) -> PlaceOptionListResponse:
    params: dict[str, Any] = {}
    where_sql = ""

    if search and search.strip():
        params["search"] = f"%{search.strip()}%"
        where_sql = "WHERE PlaceName LIKE :search"

    total = int(
        db.execute(
            text(
                f"""
                SELECT COUNT(*) AS total
                FROM places
                {where_sql}
                """
            ),
            params,
        ).scalar()
        or 0
    )

    limit_sql = apply_pagination_sql(
        params=params,
        page=page,
        page_size=page_size,
        all_items=all_items,
    )

    rows = db.execute(
        text(
            f"""
            SELECT
                P_ID AS id,
                PlaceName AS label
            FROM places
            {where_sql}
            ORDER BY PlaceName ASC
            {limit_sql}
            """
        ),
        params,
    ).mappings().all()

    items = [
        PlaceOptionItem(id=int(row["id"]), label=row["label"] or f"РњРµСЃС‚Рѕ #{row['id']}")
        for row in rows
    ]

    return PlaceOptionListResponse(
        items=items,
        pagination=build_pagination_meta(
            total=total,
            page=page,
            page_size=page_size,
            all_items=all_items,
        ),
    )


def list_publishers(
    db: Session,
    *,
    search: str | None,
    page: int,
    page_size: int,
    all_items: bool,
) -> PublisherOptionListResponse:
    params: dict[str, Any] = {}
    where_sql = ""

    if search and search.strip():
        params["search"] = f"%{search.strip()}%"
        where_sql = "WHERE PublisherName LIKE :search"

    total = int(
        db.execute(
            text(
                f"""
                SELECT COUNT(*) AS total
                FROM publishernames
                {where_sql}
                """
            ),
            params,
        ).scalar()
        or 0
    )

    limit_sql = apply_pagination_sql(
        params=params,
        page=page,
        page_size=page_size,
        all_items=all_items,
    )

    rows = db.execute(
        text(
            f"""
            SELECT
                PN_ID AS id,
                PublisherName AS label
            FROM publishernames
            {where_sql}
            ORDER BY PublisherName ASC
            {limit_sql}
            """
        ),
        params,
    ).mappings().all()

    items = [
        PublisherOptionItem(
            id=int(row["id"]),
            label=row["label"] or f"РР·РґР°С‚РµР»СЊ #{row['id']}",
        )
        for row in rows
    ]

    return PublisherOptionListResponse(
        items=items,
        pagination=build_pagination_meta(
            total=total,
            page=page,
            page_size=page_size,
            all_items=all_items,
        ),
    )


def list_medium_designators(
    db: Session,
    *,
    search: str | None,
    page: int,
    page_size: int,
    all_items: bool,
) -> MediumDesignatorOptionListResponse:
    params: dict[str, Any] = {}
    where_sql = ""

    if search and search.strip():
        params["search"] = f"%{search.strip()}%"
        where_sql = "WHERE MD_Name LIKE :search"

    total = int(
        db.execute(
            text(
                f"""
                SELECT COUNT(*) AS total
                FROM mediumdesignators
                {where_sql}
                """
            ),
            params,
        ).scalar()
        or 0
    )

    limit_sql = apply_pagination_sql(
        params=params,
        page=page,
        page_size=page_size,
        all_items=all_items,
    )

    rows = db.execute(
        text(
            f"""
            SELECT
                MD_ID AS id,
                MD_Name AS label
            FROM mediumdesignators
            {where_sql}
            ORDER BY MD_Name ASC
            {limit_sql}
            """
        ),
        params,
    ).mappings().all()

    items = [
        MediumDesignatorOptionItem(
            id=int(row["id"]),
            label=row["label"] or f"РќРѕСЃРёС‚РµР»СЊ #{row['id']}",
        )
        for row in rows
    ]

    return MediumDesignatorOptionListResponse(
        items=items,
        pagination=build_pagination_meta(
            total=total,
            page=page,
            page_size=page_size,
            all_items=all_items,
        ),
    )


def list_article_departments(
    db: Session,
    *,
    search: str | None,
    page: int,
    page_size: int,
    all_items: bool,
) -> DepartmentOptionListResponse:
    params: dict[str, Any] = {}
    where_sql = ""

    if search and search.strip():
        params["search"] = f"%{search.strip()}%"
        where_sql = """
        WHERE
            DepartmentName LIKE :search
            OR DepartmentNameEng LIKE :search
            OR CAST(DepartmentCode AS CHAR) LIKE :search
        """

    total = int(
        db.execute(
            text(
                f"""
                SELECT COUNT(*) AS total
                FROM departments
                {where_sql}
                """
            ),
            params,
        ).scalar()
        or 0
    )

    limit_sql = apply_pagination_sql(
        params=params,
        page=page,
        page_size=page_size,
        all_items=all_items,
    )

    rows = db.execute(
        text(
            f"""
            SELECT
                DepartmentCode AS id,
                DepartmentName AS label,
                DepartmentNameEng AS label_eng
            FROM departments
            {where_sql}
            ORDER BY DepartmentName ASC
            {limit_sql}
            """
        ),
        params,
    ).mappings().all()

    items = [
        DepartmentOptionItem(
            id=int(row["id"]),
            label=row["label"],
            label_eng=row.get("label_eng"),
        )
        for row in rows
    ]

    return DepartmentOptionListResponse(
        items=items,
        pagination=build_pagination_meta(
            total=total,
            page=page,
            page_size=page_size,
            all_items=all_items,
        ),
    )
