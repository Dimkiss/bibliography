from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies.auth import require_admin
from app.models import User
from app.schemas.author import AuthorCreate, AuthorUpdate
from app.services import profile_service
from app.services.author_service import (
    list_authors_full,
    get_author_by_id,
    create_author,
    update_author,
    delete_author,
    serialize_author_full,
)

router = APIRouter(prefix="/admin/authors-manage", tags=["admin-authors"])


@router.get("")
def admin_list_authors(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return list_authors_full(db)


@router.get("/{author_id}")
def admin_get_author(
    author_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return serialize_author_full(get_author_by_id(db, author_id))


@router.get("/{author_id}/publications")
def admin_get_author_publications(
    author_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(
        profile_service.DEFAULT_PAGE_SIZE,
        ge=1,
        le=profile_service.MAX_PAGE_SIZE,
    ),
    year_from: int | None = Query(None, ge=1900, le=2100),
    year_to: int | None = Query(None, ge=1900, le=2100),
    sort_by: str = Query("year"),
    sort_order: str = Query("desc"),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    get_author_by_id(db, author_id)
    return profile_service.get_profile_publications(
        db=db,
        author_id=author_id,
        page=page,
        page_size=page_size,
        year_from=year_from,
        year_to=year_to,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/{author_id}/stats")
def admin_get_author_stats(
    author_id: int,
    year_from: int | None = Query(None, ge=1900, le=2100),
    year_to: int | None = Query(None, ge=1900, le=2100),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    get_author_by_id(db, author_id)
    return profile_service.get_profile_stats(
        db=db,
        author_id=author_id,
        year_from=year_from,
        year_to=year_to,
    )


@router.post("", status_code=201)
def admin_create_author(
    payload: AuthorCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return create_author(db, payload)


@router.put("/{author_id}")
def admin_update_author(
    author_id: int,
    payload: AuthorUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return update_author(db, author_id, payload)


@router.delete("/{author_id}")
def admin_delete_author(
    author_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return delete_author(db, author_id)
