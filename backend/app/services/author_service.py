from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models import Author, Department
from app.schemas.author import AuthorCreate, AuthorUpdate


def serialize_author_full(author: Author) -> dict:
    linked_user = author.users[0] if author.users else None
    return {
        "id": author.authorID,
        "name": author.authorName,
        "position": author.position,
        "degree": author.degree,
        "rank": author.rank,
        "email": author.email,
        "wos_id": author.WOS_ID,
        "scopus_id": author.Scopus_ID,
        "orcid": author.ORCID,
        "department_id": author.DepartmentCode,
        "department_name": author.department.DepartmentName if author.department else None,
        "linked_user_id": linked_user.id if linked_user else None,
        "linked_user_login": linked_user.login if linked_user else None,
        "is_available": linked_user is None,
    }


def list_authors_full(db: Session) -> list[dict]:
    authors = db.query(Author).order_by(Author.authorName.asc()).all()
    return [serialize_author_full(a) for a in authors]


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
    if payload.position is not None:
        author.position = payload.position
    if payload.degree is not None:
        author.degree = payload.degree
    if payload.rank is not None:
        author.rank = payload.rank
    if payload.email is not None:
        author.email = payload.email
    if payload.WOS_ID is not None:
        author.WOS_ID = payload.WOS_ID
    if payload.Scopus_ID is not None:
        author.Scopus_ID = payload.Scopus_ID
    if payload.ORCID is not None:
        author.ORCID = payload.ORCID

    # DepartmentCode можно явно сбросить в None
    if "DepartmentCode" in (payload.model_fields_set if hasattr(payload, "model_fields_set") else getattr(payload, "__fields_set__", set())):
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
