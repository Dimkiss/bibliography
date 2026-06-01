from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models import Author, Department
from app.schemas.author import AuthorCreate, AuthorUpdate


def _format_date(value) -> str | None:
    return value.isoformat() if value else None


def _payload_has_field(payload, field_name: str) -> bool:
    fields_set = (
        payload.model_fields_set
        if hasattr(payload, "model_fields_set")
        else getattr(payload, "__fields_set__", set())
    )
    return field_name in fields_set


def serialize_author_full(author: Author, *, include_sensitive_fields: bool = True) -> dict:
    linked_user = author.users[0] if author.users else None
    return {
        "id": author.authorID,
        "name": author.authorName,
        "position": author.position,
        "degree": author.degree,
        "rank": author.rank,
        "email": author.email,
        "type": author.type,
        "birthdate": _format_date(author.birthdate),
        "birth_year": author.year,
        "nickname": author.nickname,
        "status": author.status,
        "search_pattern": author.Pattern,
        "external_id": author.ID if include_sensitive_fields else None,
        "snils_last4": author.snils[-4:] if author.snils and include_sensitive_fields else None,
        "wos_id": author.WOS_ID,
        "scopus_id": author.Scopus_ID,
        "orcid": author.ORCID,
        "department_id": author.DepartmentCode,
        "department_name": author.department.DepartmentName if author.department else None,
        "linked_user_id": linked_user.id if linked_user and include_sensitive_fields else None,
        "linked_user_login": linked_user.login if linked_user and include_sensitive_fields else None,
        "is_available": linked_user is None,
    }


def list_authors_full(
    db: Session,
    department_id: int | None = None,
    *,
    include_sensitive_fields: bool = True,
) -> list[dict]:
    query = db.query(Author)
    if department_id is not None:
        query = query.filter(Author.DepartmentCode == department_id)
    authors = query.order_by(Author.authorName.asc()).all()
    return [
        serialize_author_full(a, include_sensitive_fields=include_sensitive_fields)
        for a in authors
    ]


def get_author_by_id(db: Session, author_id: int) -> Author:
    author = db.query(Author).filter(Author.authorID == author_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    return author


def create_author(db: Session, payload: AuthorCreate) -> dict:
    author = Author(
        authorName=payload.authorName,
        position=payload.position,
        degree=payload.degree,
        rank=payload.rank,
        email=payload.email,
        WOS_ID=payload.WOS_ID,
        Scopus_ID=payload.Scopus_ID,
        ORCID=payload.ORCID,
        DepartmentCode=payload.DepartmentCode,
        type=payload.type or "О",
        birthdate=payload.birthdate,
        year=payload.birth_year,
        nickname=payload.nickname,
        status=payload.status if payload.status is not None else 1,
        Pattern=payload.search_pattern,
        ID=payload.external_id,
    )
    if payload.DepartmentCode is not None:
        dept = db.query(Department).filter(
            Department.DepartmentCode == payload.DepartmentCode
        ).first()
        if not dept:
            raise HTTPException(status_code=400, detail="Department not found")
    db.add(author)
    db.commit()
    db.refresh(author)
    return serialize_author_full(author)


def update_author(db: Session, author_id: int, payload: AuthorUpdate) -> dict:
    author = get_author_by_id(db, author_id)

    if payload.authorName is not None:
        author.authorName = payload.authorName
    if _payload_has_field(payload, "position"):
        author.position = payload.position
    if _payload_has_field(payload, "degree"):
        author.degree = payload.degree
    if _payload_has_field(payload, "rank"):
        author.rank = payload.rank
    if _payload_has_field(payload, "email"):
        author.email = payload.email
    if _payload_has_field(payload, "WOS_ID"):
        author.WOS_ID = payload.WOS_ID
    if _payload_has_field(payload, "Scopus_ID"):
        author.Scopus_ID = payload.Scopus_ID
    if _payload_has_field(payload, "ORCID"):
        author.ORCID = payload.ORCID
    if _payload_has_field(payload, "type") and payload.type is not None:
        author.type = payload.type
    if _payload_has_field(payload, "birthdate"):
        author.birthdate = payload.birthdate
    if _payload_has_field(payload, "birth_year"):
        author.year = payload.birth_year
    if _payload_has_field(payload, "nickname"):
        author.nickname = payload.nickname
    if _payload_has_field(payload, "status") and payload.status is not None:
        author.status = payload.status
    if _payload_has_field(payload, "search_pattern"):
        author.Pattern = payload.search_pattern
    if _payload_has_field(payload, "external_id"):
        author.ID = payload.external_id

    # DepartmentCode можно явно сбросить в None
    if _payload_has_field(payload, "DepartmentCode"):
        if payload.DepartmentCode is not None:
            dept = db.query(Department).filter(
                Department.DepartmentCode == payload.DepartmentCode
            ).first()
            if not dept:
                raise HTTPException(status_code=400, detail="Department not found")
        author.DepartmentCode = payload.DepartmentCode

    db.commit()
    db.refresh(author)
    return serialize_author_full(author)


def has_publications(db: Session, author_id: int) -> bool:
    result = db.execute(
        text("SELECT COUNT(*) FROM articlehasauthor WHERE authorID_f = :aid"),
        {"aid": author_id},
    ).scalar()
    return int(result or 0) > 0


def delete_author(db: Session, author_id: int) -> dict:
    author = get_author_by_id(db, author_id)
    if author.users:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete author linked to a user account.",
        )
    if has_publications(db, author_id):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete author with linked publications.",
        )
    db.delete(author)
    db.commit()
    return {"status": "deleted"}


def link_author_publication(db: Session, author_id: int, article_id: int) -> dict:
    get_author_by_id(db, author_id)

    article_exists = db.execute(
        text("SELECT COUNT(*) FROM articles WHERE Record_ID = :article_id"),
        {"article_id": article_id},
    ).scalar()
    if int(article_exists or 0) == 0:
        raise HTTPException(status_code=404, detail="Publication not found")

    link_exists = db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM articlehasauthor
            WHERE Record_ID_f = :article_id
              AND authorID_f = :author_id
            """
        ),
        {"article_id": article_id, "author_id": author_id},
    ).scalar()
    if int(link_exists or 0) > 0:
        raise HTTPException(
            status_code=400,
            detail="Publication is already linked to this author.",
        )

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
                1,
                0
            )
            """
        ),
        {"article_id": article_id, "author_id": author_id},
    )
    db.commit()

    return {"status": "linked"}
