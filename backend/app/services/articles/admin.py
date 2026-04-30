from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.schemas.article import (
    ArticleCreatePayload,
    ArticleDetailResponse,
    ArticleEditResponse,
    ArticleSearchItem,
    ArticleSearchResponse,
    ArticleUpdatePayload,
    SelectedAuthorItem,
)
from app.services.articles.exceptions import (
    ArticleConflictError,
    ArticleNotFoundError,
    ArticleValidationError,
)
from app.services.articles.pagination import (
    apply_pagination_sql,
    build_pagination_meta,
)
from app.services.articles import public as public_service


def _payload_to_dict(payload: Any, *, exclude_unset: bool = False) -> dict[str, Any]:
    if hasattr(payload, "model_dump"):
        return payload.model_dump(exclude_unset=exclude_unset)
    return payload.dict(exclude_unset=exclude_unset)


def _normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _normalize_unique_strings(values: list[str] | None) -> list[str]:
    if not values:
        return []

    result: list[str] = []
    seen: set[str] = set()

    for value in values:
        stripped = value.strip()
        if not stripped:
            continue

        lowered = stripped.lower()
        if lowered in seen:
            continue

        seen.add(lowered)
        result.append(stripped)

    return result


def _article_exists(db: Session, article_id: int) -> bool:
    row = db.execute(
        text("SELECT 1 FROM articles WHERE Record_ID = :article_id"),
        {"article_id": article_id},
    ).first()
    return row is not None


def _validate_entity_exists(
    db: Session,
    *,
    table: str,
    id_column: str,
    entity_id: int | None,
    entity_name: str,
) -> None:
    if entity_id is None:
        return

    row = db.execute(
        text(f"SELECT 1 FROM {table} WHERE {id_column} = :entity_id"),
        {"entity_id": entity_id},
    ).first()

    if row is None:
        raise ArticleNotFoundError(f"{entity_name} not found.")


def _work_form_type_exists(db: Session, work_form_type: str) -> bool:
    row = db.execute(
        text(
            """
            SELECT 1
            FROM workformstypes
            WHERE WorkformFlag = :work_form_type
            """
        ),
        {"work_form_type": work_form_type},
    ).first()
    return row is not None


def _resolve_allowed_publication_type_flags_for_work_form(
    db: Session,
    work_form_type: str | None,
) -> set[str]:
    if not work_form_type:
        return set()

    rows = db.execute(
        text(
            """
            SELECT TOP_Flag_f AS flag
            FROM tophasworkformtype
            WHERE WorkformFlag_f = :work_form_type
            """
        ),
        {"work_form_type": work_form_type},
    ).mappings().all()

    return {row["flag"] for row in rows if row.get("flag")}


def _resolve_publication_type_flags(
    db: Session,
    flags: list[str],
    *,
    work_form_type: str | None = None,
) -> list[str]:
    normalized_flags = _normalize_unique_strings(flags)
    if not normalized_flags:
        return []

    placeholders = ", ".join(f":flag_{index}" for index in range(len(normalized_flags)))
    params = {f"flag_{index}": value for index, value in enumerate(normalized_flags)}

    rows = db.execute(
        text(
            f"""
            SELECT TOP_Flag
            FROM typesofpublications
            WHERE TOP_Flag IN ({placeholders})
            """
        ),
        params,
    ).mappings().all()

    existing_flags = {row["TOP_Flag"] for row in rows}
    missing_flags = [value for value in normalized_flags if value not in existing_flags]

    if missing_flags:
        raise ArticleValidationError(f"Unknown publication type flags: {', '.join(missing_flags)}")

    allowed_flags = _resolve_allowed_publication_type_flags_for_work_form(db, work_form_type)
    if allowed_flags:
        invalid_for_work_form = [
            value for value in normalized_flags if value not in allowed_flags
        ]
        if invalid_for_work_form:
            raise ArticleValidationError((
                    "Some publication type flags are not allowed for the selected work form type: "
                    + ", ".join(invalid_for_work_form)
                ))

    return normalized_flags


def _resolve_keyword_ids(db: Session, keywords: list[str]) -> list[int]:
    normalized_keywords = _normalize_unique_strings(keywords)
    if not normalized_keywords:
        return []

    placeholders = ", ".join(
        f":keyword_{index}" for index in range(len(normalized_keywords))
    )
    params = {
        f"keyword_{index}": value for index, value in enumerate(normalized_keywords)
    }

    existing_rows = db.execute(
        text(
            f"""
            SELECT K_ID, Keyword
            FROM keywords
            WHERE Keyword IN ({placeholders})
            """
        ),
        params,
    ).mappings().all()

    keyword_to_id = {row["Keyword"]: int(row["K_ID"]) for row in existing_rows}

    for keyword in normalized_keywords:
        if keyword in keyword_to_id:
            continue

        insert_result = db.execute(
            text(
                """
                INSERT INTO keywords (Keyword)
                VALUES (:keyword)
                """
            ),
            {"keyword": keyword},
        )
        keyword_to_id[keyword] = int(insert_result.lastrowid)

    return [keyword_to_id[keyword] for keyword in normalized_keywords]


def _validate_department_codes(db: Session, department_codes: list[int]) -> list[int]:
    normalized_codes = list(dict.fromkeys(department_codes))
    if not normalized_codes:
        return []

    placeholders = ", ".join(
        f":department_code_{index}" for index in range(len(normalized_codes))
    )
    params = {
        f"department_code_{index}": value
        for index, value in enumerate(normalized_codes)
    }

    rows = db.execute(
        text(
            f"""
            SELECT DepartmentCode
            FROM departments
            WHERE DepartmentCode IN ({placeholders})
            """
        ),
        params,
    ).mappings().all()

    existing_codes = {int(row["DepartmentCode"]) for row in rows}
    missing_codes = [value for value in normalized_codes if value not in existing_codes]

    if missing_codes:
        raise ArticleValidationError(f"Unknown article department codes: {', '.join(map(str, missing_codes))}")

    return normalized_codes


def _validate_authors(
    db: Session,
    authors: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not authors:
        return []

    normalized_authors: list[dict[str, Any]] = []
    seen_ids: set[int] = set()

    for item in authors:
        author_id = int(item["author_id"])
        if author_id in seen_ids:
            continue

        seen_ids.add(author_id)
        normalized_authors.append(
            {
                "author_id": author_id,
                "affiliation": int(item.get("affiliation") or 1),
                "corresponding_author": bool(item.get("corresponding_author", False)),
            }
        )

    placeholders = ", ".join(
        f":author_id_{index}" for index in range(len(normalized_authors))
    )
    params = {
        f"author_id_{index}": item["author_id"]
        for index, item in enumerate(normalized_authors)
    }

    rows = db.execute(
        text(
            f"""
            SELECT authorID
            FROM authors
            WHERE authorID IN ({placeholders})
            """
        ),
        params,
    ).mappings().all()

    existing_ids = {int(row["authorID"]) for row in rows}
    missing_ids = [
        item["author_id"] for item in normalized_authors if item["author_id"] not in existing_ids
    ]

    if missing_ids:
        raise ArticleValidationError(f"Unknown author ids: {', '.join(map(str, missing_ids))}")

    corresponding_count = sum(
        1 for item in normalized_authors if item["corresponding_author"]
    )
    if corresponding_count > 1:
        raise ArticleValidationError("Only one corresponding author is allowed.")

    return normalized_authors


def _build_authors_text_from_selected_authors(
    db: Session,
    authors: list[dict[str, Any]],
) -> str | None:
    if not authors:
        return None

    placeholders = ", ".join(
        f":author_id_{index}" for index in range(len(authors))
    )
    params = {
        f"author_id_{index}": item["author_id"]
        for index, item in enumerate(authors)
    }

    rows = db.execute(
        text(
            f"""
            SELECT authorID, authorName
            FROM authors
            WHERE authorID IN ({placeholders})
            """
        ),
        params,
    ).mappings().all()

    id_to_name = {
        int(row["authorID"]): row["authorName"]
        for row in rows
        if row.get("authorName")
    }

    names = [id_to_name[item["author_id"]] for item in authors if item["author_id"] in id_to_name]
    return ", ".join(names) if names else None


def _replace_article_publication_types(
    db: Session,
    article_id: int,
    publication_type_flags: list[str],
) -> None:
    db.execute(
        text(
            """
            DELETE FROM articlehastop
            WHERE Record_ID_f = :article_id
            """
        ),
        {"article_id": article_id},
    )

    for flag in publication_type_flags:
        db.execute(
            text(
                """
                INSERT INTO articlehastop (Record_ID_f, TypeOfPublication_f)
                VALUES (:article_id, :flag)
                """
            ),
            {"article_id": article_id, "flag": flag},
        )


def _replace_article_keywords(
    db: Session,
    article_id: int,
    keywords: list[str],
) -> None:
    db.execute(
        text(
            """
            DELETE FROM articlehaskeywords
            WHERE Record_ID_f = :article_id
            """
        ),
        {"article_id": article_id},
    )

    keyword_ids = _resolve_keyword_ids(db, keywords)
    for keyword_id in keyword_ids:
        db.execute(
            text(
                """
                INSERT INTO articlehaskeywords (Record_ID_f, Keyword_ID_f)
                VALUES (:article_id, :keyword_id)
                """
            ),
            {"article_id": article_id, "keyword_id": keyword_id},
        )


def _replace_article_departments(
    db: Session,
    article_id: int,
    department_codes: list[int],
) -> None:
    db.execute(
        text(
            """
            DELETE FROM articlehasdepartment
            WHERE Record_ID_frn = :article_id
            """
        ),
        {"article_id": article_id},
    )

    for department_code in department_codes:
        db.execute(
            text(
                """
                INSERT INTO articlehasdepartment (Record_ID_frn, DepartmentCode_f)
                VALUES (:article_id, :department_code)
                """
            ),
            {"article_id": article_id, "department_code": department_code},
        )


def _replace_article_authors(
    db: Session,
    article_id: int,
    authors: list[dict[str, Any]],
) -> None:
    db.execute(
        text(
            """
            DELETE FROM articlehasauthor
            WHERE Record_ID_f = :article_id
            """
        ),
        {"article_id": article_id},
    )

    for item in authors:
        db.execute(
            text(
                """
                INSERT INTO articlehasauthor (
                    Record_ID_f,
                    authorID_f,
                    affiliation,
                    corresponding_author
                )
                VALUES (
                    :article_id,
                    :author_id,
                    :affiliation,
                    :corresponding_author
                )
                """
            ),
            {
                "article_id": article_id,
                "author_id": item["author_id"],
                "affiliation": item["affiliation"],
                "corresponding_author": 1 if item["corresponding_author"] else 0,
            },
        )


def _upsert_article_details(
    db: Session,
    article_id: int,
    details_fields: dict[str, Any],
) -> None:
    if not details_fields:
        return

    existing_row = db.execute(
        text(
            """
            SELECT AD_ID
            FROM articledetails
            WHERE Record_ID_f = :article_id
            """
        ),
        {"article_id": article_id},
    ).mappings().first()

    if existing_row:
        set_clause = ", ".join(f"{column} = :{column}" for column in details_fields.keys())
        params = dict(details_fields)
        params["article_id"] = article_id

        db.execute(
            text(
                f"""
                UPDATE articledetails
                SET {set_clause}
                WHERE Record_ID_f = :article_id
                """
            ),
            params,
        )
        return

    columns = ", ".join(["Record_ID_f", *details_fields.keys()])
    placeholders = ", ".join([":article_id", *[f":{column}" for column in details_fields.keys()]])
    params = dict(details_fields)
    params["article_id"] = article_id

    db.execute(
        text(
            f"""
            INSERT INTO articledetails ({columns})
            VALUES ({placeholders})
            """
        ),
        params,
    )


def _upsert_journal_article_attributes(
    db: Session,
    article_id: int,
    attrs_fields: dict[str, Any],
) -> None:
    if not attrs_fields:
        return

    existing_row = db.execute(
        text(
            """
            SELECT JAA_ID
            FROM journalarticlesattributes
            WHERE Record_ID_f = :article_id
            """
        ),
        {"article_id": article_id},
    ).mappings().first()

    if existing_row:
        set_clause = ", ".join(f"{column} = :{column}" for column in attrs_fields.keys())
        params = dict(attrs_fields)
        params["article_id"] = article_id

        db.execute(
            text(
                f"""
                UPDATE journalarticlesattributes
                SET {set_clause}
                WHERE Record_ID_f = :article_id
                """
            ),
            params,
        )
        return

    attrs_with_defaults = {
        "OriginalVer_ID_f": None,
        "PerVer_ID_f": None,
        "ArticleLanguage": None,
        "Tirage": None,
        "WosExcluded": 0,
        "ScopusExcluded": 0,
    }
    attrs_with_defaults.update(attrs_fields)

    columns = ", ".join(["Record_ID_f", *attrs_with_defaults.keys()])
    placeholders = ", ".join(
        [":article_id", *[f":{column}" for column in attrs_with_defaults.keys()]]
    )
    params = dict(attrs_with_defaults)
    params["article_id"] = article_id

    db.execute(
        text(
            f"""
            INSERT INTO journalarticlesattributes ({columns})
            VALUES ({placeholders})
            """
        ),
        params,
    )


def _validate_related_article_ids(
    db: Session,
    article_id: int | None,
    original_version_id: int | None,
    translation_version_id: int | None,
) -> None:
    if (
        original_version_id is not None
        and translation_version_id is not None
        and original_version_id == translation_version_id
    ):
        raise ArticleValidationError("Original and translation article IDs must be different.")

    for related_article_id, label in (
        (original_version_id, "Original version"),
        (translation_version_id, "Translation version"),
    ):
        if related_article_id is None:
            continue

        if article_id is not None and related_article_id == article_id:
            raise ArticleValidationError(f"{label} ID cannot be equal to the edited article ID.")

        if not _article_exists(db, related_article_id):
            raise ArticleNotFoundError(f"{label} article not found.")


def _prepare_payload(
    db: Session,
    raw_data: dict[str, Any],
    *,
    is_create: bool,
    article_id: int | None = None,
) -> tuple[
    dict[str, Any],
    dict[str, Any],
    dict[str, Any],
    list[str] | None,
    list[str] | None,
    list[int] | None,
    list[dict[str, Any]] | None,
]:
    data = dict(raw_data)

    if "title" in data:
        data["title"] = _normalize_optional_string(data["title"])
        if not data["title"]:
            raise ArticleValidationError("Title is required.")

    if "year" in data and data["year"] is None:
        raise ArticleValidationError("Year cannot be null.")

    if is_create and "year" not in data:
        raise ArticleValidationError("Year is required.")

    for key in (
        "authors_text",
        "author_role",
        "abstract",
        "doi",
        "edition",
        "author_of_material",
        "title_of_material",
        "date_of_meeting",
        "volume",
        "issue",
        "pages",
        "extent_of_work",
        "url",
        "issn",
        "isbn",
        "notes",
        "speaker",
        "ship",
        "article_language",
        "tirage",
        "work_form_type",
    ):
        if key in data:
            data[key] = _normalize_optional_string(data[key])

    if "work_form_type" in data and data["work_form_type"]:
        if not _work_form_type_exists(db, data["work_form_type"]):
            raise ArticleValidationError("Unknown work form type.")

    if "journal_id" in data:
        _validate_entity_exists(
            db,
            table="journals",
            id_column="J_ID",
            entity_id=data.get("journal_id"),
            entity_name="Journal",
        )

    if "medium_designator_id" in data:
        _validate_entity_exists(
            db,
            table="mediumdesignators",
            id_column="MD_ID",
            entity_id=data.get("medium_designator_id"),
            entity_name="Medium designator",
        )

    if "place_of_meeting_id" in data:
        _validate_entity_exists(
            db,
            table="places",
            id_column="P_ID",
            entity_id=data.get("place_of_meeting_id"),
            entity_name="Place of meeting",
        )

    if "place_of_publication_id" in data:
        _validate_entity_exists(
            db,
            table="places",
            id_column="P_ID",
            entity_id=data.get("place_of_publication_id"),
            entity_name="Place of publication",
        )

    if "publisher_id" in data:
        _validate_entity_exists(
            db,
            table="publishernames",
            id_column="PN_ID",
            entity_id=data.get("publisher_id"),
            entity_name="Publisher",
        )

    publication_type_flags = data.pop("publication_type_flags", None)
    if publication_type_flags is not None:
        publication_type_flags = _resolve_publication_type_flags(
            db,
            publication_type_flags,
            work_form_type=data.get("work_form_type"),
        )

    keywords = data.pop("keywords", None)
    if keywords is not None:
        keywords = _normalize_unique_strings(keywords)

    department_codes = data.pop("department_codes", None)
    if department_codes is not None:
        department_codes = _validate_department_codes(db, department_codes)

    selected_authors = data.pop("authors", None)
    if selected_authors is not None:
        selected_authors = _validate_authors(db, selected_authors)

        if not data.get("authors_text"):
            data["authors_text"] = _build_authors_text_from_selected_authors(
                db,
                selected_authors,
            )

    original_version_id = data.get("original_version_id")
    translation_version_id = data.get("translation_version_id")

    _validate_related_article_ids(
        db,
        article_id=article_id,
        original_version_id=original_version_id,
        translation_version_id=translation_version_id,
    )

    scalar_fields: dict[str, Any] = {}
    details_fields: dict[str, Any] = {}
    attrs_fields: dict[str, Any] = {}

    scalar_field_map = {
        "title": "Title_Analitic_F4",
        "authors_text": "Author_Analitic_F1",
        "author_role": "AuthorRole_F2",
        "journal_id": "Journal_ID_f",
        "work_form_type": "WorkFormType_f",
        "medium_designator_id": "MediumDesignator_F5_f",
        "author_of_material": "Author_of_Material_F7",
        "title_of_material": "Title_of_Material_F9",
        "date_of_meeting": "DateOfMeeting_F12",
        "place_of_meeting_id": "PlaceOfMeeting_F13_f",
        "edition": "Edition_F15",
        "place_of_publication_id": "PlaceOfPublication_F18_f",
        "publisher_id": "PublisherName_F19_f",
        "publication_date": "PublicationDate",
        "year": "Date_of_Publication_F20",
        "volume": "VolumeID_F22",
        "issue": "IssueID_F24",
        "pages": "Pages_F25",
        "extent_of_work": "ExtentOfWork_F26",
        "url": "URL_F38",
        "issn": "ISSN_F40",
        "isbn": "ISBN_F41",
        "notes": "Notes_F42",
        "abstract": "Abstract_F43",
        "doi": "DOI",
        "speaker": "Speaker",
    }

    details_field_map = {
        "num_foreigners": "Num_Foreigners",
        "ship": "ship",
    }

    attrs_field_map = {
        "original_version_id": "OriginalVer_ID_f",
        "translation_version_id": "PerVer_ID_f",
        "article_language": "ArticleLanguage",
        "tirage": "Tirage",
    }

    for payload_key, column_name in scalar_field_map.items():
        if payload_key in data:
            scalar_fields[column_name] = data[payload_key]

    for payload_key, column_name in details_field_map.items():
        if payload_key in data:
            details_fields[column_name] = data[payload_key]

    for payload_key, column_name in attrs_field_map.items():
        if payload_key in data:
            attrs_fields[column_name] = data[payload_key]

    if "wos_excluded" in data:
        attrs_fields["WosExcluded"] = 1 if data["wos_excluded"] else 0

    if "scopus_excluded" in data:
        attrs_fields["ScopusExcluded"] = 1 if data["scopus_excluded"] else 0

    return (
        scalar_fields,
        details_fields,
        attrs_fields,
        publication_type_flags,
        keywords,
        department_codes,
        selected_authors,
    )


def create_article(
    db: Session,
    *,
    payload: ArticleCreatePayload,
) -> ArticleDetailResponse:
    raw_data = _payload_to_dict(payload)
    (
        scalar_fields,
        details_fields,
        attrs_fields,
        publication_type_flags,
        keywords,
        department_codes,
        selected_authors,
    ) = _prepare_payload(db, raw_data, is_create=True)

    scalar_fields.setdefault("InsertDate", date.today())

    columns = ", ".join(scalar_fields.keys())
    placeholders = ", ".join(f":{column}" for column in scalar_fields.keys())

    try:
        insert_result = db.execute(
            text(
                f"""
                INSERT INTO articles ({columns})
                VALUES ({placeholders})
                """
            ),
            scalar_fields,
        )
        article_id = int(insert_result.lastrowid)

        _replace_article_publication_types(
            db,
            article_id,
            publication_type_flags or [],
        )
        _replace_article_keywords(
            db,
            article_id,
            keywords or [],
        )
        _replace_article_departments(
            db,
            article_id,
            department_codes or [],
        )
        _replace_article_authors(
            db,
            article_id,
            selected_authors or [],
        )
        _upsert_article_details(
            db,
            article_id,
            details_fields,
        )
        _upsert_journal_article_attributes(
            db,
            article_id,
            attrs_fields,
        )

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ArticleConflictError(
            "Could not create article because of related data constraints."
        ) from exc

    return public_service.get_article_detail(article_id=article_id, db=db)


def update_article(
    db: Session,
    *,
    article_id: int,
    payload: ArticleUpdatePayload,
) -> ArticleDetailResponse:
    if not _article_exists(db, article_id):
        raise ArticleNotFoundError("Article not found.")

    raw_data = _payload_to_dict(payload, exclude_unset=True)
    (
        scalar_fields,
        details_fields,
        attrs_fields,
        publication_type_flags,
        keywords,
        department_codes,
        selected_authors,
    ) = _prepare_payload(
        db,
        raw_data,
        is_create=False,
        article_id=article_id,
    )

    try:
        if scalar_fields:
            set_clause = ", ".join(f"{column} = :{column}" for column in scalar_fields.keys())
            params = dict(scalar_fields)
            params["article_id"] = article_id

            db.execute(
                text(
                    f"""
                    UPDATE articles
                    SET {set_clause}
                    WHERE Record_ID = :article_id
                    """
                ),
                params,
            )

        if publication_type_flags is not None:
            _replace_article_publication_types(db, article_id, publication_type_flags)

        if keywords is not None:
            _replace_article_keywords(db, article_id, keywords)

        if department_codes is not None:
            _replace_article_departments(db, article_id, department_codes)

        if selected_authors is not None:
            _replace_article_authors(db, article_id, selected_authors)

        if details_fields:
            _upsert_article_details(db, article_id, details_fields)

        if attrs_fields:
            _upsert_journal_article_attributes(db, article_id, attrs_fields)

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ArticleConflictError(
            "Could not update article because of related data constraints."
        ) from exc

    return public_service.get_article_detail(article_id=article_id, db=db)


def delete_article(
    db: Session,
    *,
    article_id: int,
) -> None:
    if not _article_exists(db, article_id):
        raise ArticleNotFoundError("Article not found.")

    try:
        db.execute(
            text(
                """
                UPDATE journalarticlesattributes
                SET OriginalVer_ID_f = NULL
                WHERE OriginalVer_ID_f = :article_id
                """
            ),
            {"article_id": article_id},
        )

        db.execute(
            text(
                """
                UPDATE journalarticlesattributes
                SET PerVer_ID_f = NULL
                WHERE PerVer_ID_f = :article_id
                """
            ),
            {"article_id": article_id},
        )

        db.execute(
            text(
                """
                DELETE FROM journalarticlesattributes
                WHERE Record_ID_f = :article_id
                """
            ),
            {"article_id": article_id},
        )

        db.execute(
            text(
                """
                DELETE FROM articledetails
                WHERE Record_ID_f = :article_id
                """
            ),
            {"article_id": article_id},
        )

        db.execute(
            text(
                """
                DELETE FROM articlehaskeywords
                WHERE Record_ID_f = :article_id
                """
            ),
            {"article_id": article_id},
        )

        db.execute(
            text(
                """
                DELETE FROM articlehastop
                WHERE Record_ID_f = :article_id
                """
            ),
            {"article_id": article_id},
        )

        db.execute(
            text(
                """
                DELETE FROM articlehasauthor
                WHERE Record_ID_f = :article_id
                """
            ),
            {"article_id": article_id},
        )

        db.execute(
            text(
                """
                DELETE FROM articlehasdepartment
                WHERE Record_ID_frn = :article_id
                """
            ),
            {"article_id": article_id},
        )

        db.execute(
            text(
                """
                DELETE FROM projectshasarticles
                WHERE Record_ID_f = :article_id
                """
            ),
            {"article_id": article_id},
        )

        db.execute(
            text(
                """
                DELETE FROM articles
                WHERE Record_ID = :article_id
                """
            ),
            {"article_id": article_id},
        )

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ArticleConflictError(
            "Could not delete article because of related data constraints."
        ) from exc

def search_articles(
    db: Session,
    *,
    query: str | None,
    exclude_id: int | None,
    page: int,
    page_size: int,
    all_items: bool,
) -> ArticleSearchResponse:
    params: dict[str, Any] = {}
    conditions: list[str] = []

    if query and query.strip():
        params["query"] = f"%{query.strip()}%"
        conditions.append(
            """
            (
                a.Title_Analitic_F4 LIKE :query
                OR a.Author_Analitic_F1 LIKE :query
                OR a.DOI LIKE :query
                OR COALESCE(NULLIF(jn.JournalName, ''), NULLIF(j.jname, ''), NULLIF(a.Edition_F15, '')) LIKE :query
                OR CAST(a.Record_ID AS CHAR) LIKE :query
            )
            """
        )

    if exclude_id is not None:
        params["exclude_id"] = exclude_id
        conditions.append("a.Record_ID <> :exclude_id")

    where_sql = ""
    if conditions:
        where_sql = "WHERE " + " AND ".join(conditions)

    total = int(
        db.execute(
            text(
                f"""
                SELECT COUNT(*) AS total
                FROM articles a
                LEFT JOIN journals j ON j.J_ID = a.Journal_ID_f
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
                a.Record_ID AS id,
                a.Title_Analitic_F4 AS title,
                COALESCE(
                    (
                        SELECT GROUP_CONCAT(DISTINCT au.authorName ORDER BY aha.AHA_ID SEPARATOR ', ')
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
            {where_sql}
            ORDER BY a.Date_of_Publication_F20 DESC, a.Record_ID DESC
            {limit_sql}
            """
        ),
        params,
    ).mappings().all()

    items = [
        ArticleSearchItem(
            id=int(row["id"]),
            title=row.get("title"),
            authors=row.get("authors"),
            journal=row.get("journal"),
            year=row.get("year"),
            doi=row.get("doi"),
        )
        for row in rows
    ]

    return ArticleSearchResponse(
        items=items,
        pagination=build_pagination_meta(
            total=total,
            page=page,
            page_size=page_size,
            all_items=all_items,
        ),
    )


def get_article_for_edit(
    db: Session,
    *,
    article_id: int,
) -> ArticleEditResponse:
    row = db.execute(
        text(
            """
            SELECT
                a.Record_ID AS id,
                a.Title_Analitic_F4 AS title,
                a.Date_of_Publication_F20 AS year,
                a.Author_Analitic_F1 AS authors_text,
                a.AuthorRole_F2 AS author_role,
                a.Abstract_F43 AS abstract,
                a.DOI AS doi,
                a.Journal_ID_f AS journal_id,
                a.Edition_F15 AS edition,
                a.WorkFormType_f AS work_form_type,
                a.MediumDesignator_F5_f AS medium_designator_id,
                a.Author_of_Material_F7 AS author_of_material,
                a.Title_of_Material_F9 AS title_of_material,
                a.DateOfMeeting_F12 AS date_of_meeting,
                a.PlaceOfMeeting_F13_f AS place_of_meeting_id,
                a.PlaceOfPublication_F18_f AS place_of_publication_id,
                a.PublisherName_F19_f AS publisher_id,
                a.PublicationDate AS publication_date,
                a.VolumeID_F22 AS volume,
                a.IssueID_F24 AS issue,
                a.Pages_F25 AS pages,
                a.ExtentOfWork_F26 AS extent_of_work,
                a.URL_F38 AS url,
                a.ISSN_F40 AS issn,
                a.ISBN_F41 AS isbn,
                a.Notes_F42 AS notes,
                a.Speaker AS speaker,
                ad.Num_Foreigners AS num_foreigners,
                ad.ship AS ship,
                jaa.OriginalVer_ID_f AS original_version_id,
                jaa.PerVer_ID_f AS translation_version_id,
                jaa.ArticleLanguage AS article_language,
                jaa.Tirage AS tirage,
                jaa.WosExcluded AS wos_excluded,
                jaa.ScopusExcluded AS scopus_excluded
            FROM articles a
            LEFT JOIN articledetails ad ON ad.Record_ID_f = a.Record_ID
            LEFT JOIN journalarticlesattributes jaa ON jaa.Record_ID_f = a.Record_ID
            WHERE a.Record_ID = :article_id
            """
        ),
        {"article_id": article_id},
    ).mappings().first()

    if row is None:
        raise ArticleNotFoundError("Article not found.")

    publication_type_rows = db.execute(
        text(
            """
            SELECT TypeOfPublication_f AS flag
            FROM articlehastop
            WHERE Record_ID_f = :article_id
            ORDER BY TypeOfPublication_f
            """
        ),
        {"article_id": article_id},
    ).mappings().all()

    keyword_rows = db.execute(
        text(
            """
            SELECT k.Keyword AS keyword
            FROM articlehaskeywords ahk
            JOIN keywords k ON k.K_ID = ahk.Keyword_ID_f
            WHERE ahk.Record_ID_f = :article_id
            ORDER BY k.Keyword
            """
        ),
        {"article_id": article_id},
    ).mappings().all()

    department_rows = db.execute(
        text(
            """
            SELECT DepartmentCode_f AS department_code
            FROM articlehasdepartment
            WHERE Record_ID_frn = :article_id
            ORDER BY DepartmentCode_f
            """
        ),
        {"article_id": article_id},
    ).mappings().all()

    author_rows = db.execute(
        text(
            """
            SELECT
                aha.authorID_f AS author_id,
                au.authorName AS author_name,
                aha.affiliation AS affiliation,
                aha.corresponding_author AS corresponding_author
            FROM articlehasauthor aha
            JOIN authors au ON au.authorID = aha.authorID_f
            WHERE aha.Record_ID_f = :article_id
            ORDER BY aha.AHA_ID ASC
            """
        ),
        {"article_id": article_id},
    ).mappings().all()

    return ArticleEditResponse(
        id=int(row["id"]),
        title=row.get("title"),
        year=row.get("year"),
        authors_text=row.get("authors_text"),
        authors=[
            SelectedAuthorItem(
                author_id=int(item["author_id"]),
                author_name=item["author_name"],
                affiliation=int(item.get("affiliation") or 1),
                corresponding_author=bool(item.get("corresponding_author")),
            )
            for item in author_rows
        ],
        author_role=row.get("author_role"),
        abstract=row.get("abstract"),
        doi=row.get("doi"),
        journal_id=row.get("journal_id"),
        edition=row.get("edition"),
        work_form_type=row.get("work_form_type"),
        medium_designator_id=row.get("medium_designator_id"),
        author_of_material=row.get("author_of_material"),
        title_of_material=row.get("title_of_material"),
        date_of_meeting=row.get("date_of_meeting"),
        place_of_meeting_id=row.get("place_of_meeting_id"),
        place_of_publication_id=row.get("place_of_publication_id"),
        publisher_id=row.get("publisher_id"),
        publication_date=(
            row.get("publication_date").isoformat()
            if row.get("publication_date")
            else None
        ),
        volume=row.get("volume"),
        issue=row.get("issue"),
        pages=row.get("pages"),
        extent_of_work=row.get("extent_of_work"),
        url=row.get("url"),
        issn=row.get("issn"),
        isbn=row.get("isbn"),
        notes=row.get("notes"),
        speaker=row.get("speaker"),
        publication_type_flags=[
            row_item["flag"] for row_item in publication_type_rows if row_item.get("flag")
        ],
        keywords=[
            row_item["keyword"] for row_item in keyword_rows if row_item.get("keyword")
        ],
        department_codes=[
            int(row_item["department_code"])
            for row_item in department_rows
            if row_item.get("department_code") is not None
        ],
        original_version_id=row.get("original_version_id"),
        translation_version_id=row.get("translation_version_id"),
        article_language=row.get("article_language"),
        tirage=row.get("tirage"),
        wos_excluded=(
            bool(row.get("wos_excluded"))
            if row.get("wos_excluded") is not None
            else None
        ),
        scopus_excluded=(
            bool(row.get("scopus_excluded"))
            if row.get("scopus_excluded") is not None
            else None
        ),
        num_foreigners=row.get("num_foreigners"),
        ship=row.get("ship"),
    )
