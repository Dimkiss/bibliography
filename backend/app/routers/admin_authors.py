from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies.auth import require_admin, require_authors_page_access
from app.models import User
from app.roles import ADMIN_ROLE_ID, DEPARTMENT_HEAD_ROLE_ID
from app.schemas.author import AuthorCreate, AuthorUpdate
from app.services import profile_service
from app.services.author_service import (
    list_authors_full,
    get_author_by_id,
    create_author,
    update_author,
    delete_author,
    link_author_publication,
    serialize_author_full,
)

router = APIRouter(prefix="/admin/authors-manage", tags=["admin-authors"])


@router.get("")
def admin_list_authors(
    department_id: int | None = Query(None),
    current_user: User = Depends(require_authors_page_access),
    db: Session = Depends(get_db),
):
    # Руководитель подразделения видит только своё подразделение
    if current_user.role_id == DEPARTMENT_HEAD_ROLE_ID:
        return list_authors_full(db, department_id=current_user.department_id)

    # Администратор и администрация могут фильтровать по department_id
    return list_authors_full(db, department_id=department_id)


@router.get("/{author_id}")
def admin_get_author(
    author_id: int,
    current_user: User = Depends(require_authors_page_access),
    db: Session = Depends(get_db),
):
    author = get_author_by_id(db, author_id)
    # Руководитель подразделения может смотреть только авторов своего подразделения
    if current_user.role_id == DEPARTMENT_HEAD_ROLE_ID:
        if author.DepartmentCode != current_user.department_id:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return serialize_author_full(author)


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
    text_query: str | None = Query(None),
    publication_types: list[str] | None = Query(None),
    databases: list[str] | None = Query(None),
    original_translation_mode: str = Query("all"),
    sort_by: str = Query("year"),
    sort_order: str = Query("desc"),
    current_user: User = Depends(require_authors_page_access),
    db: Session = Depends(get_db),
):
    author = get_author_by_id(db, author_id)
    if current_user.role_id == DEPARTMENT_HEAD_ROLE_ID:
        if author.DepartmentCode != current_user.department_id:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return profile_service.get_profile_publications(
        db=db,
        author_id=author_id,
        page=page,
        page_size=page_size,
        year_from=year_from,
        year_to=year_to,
        text_query=text_query,
        publication_types=publication_types,
        databases=databases,
        original_translation_mode=original_translation_mode,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/{author_id}/stats")
def admin_get_author_stats(
    author_id: int,
    year_from: int | None = Query(None, ge=1900, le=2100),
    year_to: int | None = Query(None, ge=1900, le=2100),
    text_query: str | None = Query(None),
    publication_types: list[str] | None = Query(None),
    databases: list[str] | None = Query(None),
    original_translation_mode: str = Query("all"),
    current_user: User = Depends(require_authors_page_access),
    db: Session = Depends(get_db),
):
    author = get_author_by_id(db, author_id)
    if current_user.role_id == DEPARTMENT_HEAD_ROLE_ID:
        if author.DepartmentCode != current_user.department_id:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return profile_service.get_profile_stats(
        db=db,
        author_id=author_id,
        year_from=year_from,
        year_to=year_to,
        text_query=text_query,
        publication_types=publication_types,
        databases=databases,
        original_translation_mode=original_translation_mode,
    )


@router.post("/{author_id}/publications/{article_id}", status_code=201)
def admin_link_author_publication(
    author_id: int,
    article_id: int,
    current_user: User = Depends(require_authors_page_access),
    db: Session = Depends(get_db),
):
    author = get_author_by_id(db, author_id)
    if current_user.role_id == DEPARTMENT_HEAD_ROLE_ID:
        if author.DepartmentCode != current_user.department_id:
            from fastapi import HTTPException, status
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return link_author_publication(db, author_id, article_id)


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
