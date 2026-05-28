from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies.auth import require_admin
from app.models import User
from app.schemas.author import AuthorCreate, AuthorUpdate
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
