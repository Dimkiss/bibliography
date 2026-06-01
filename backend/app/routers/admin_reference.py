from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies.auth import require_admin, require_authors_page_access
from app.models import User
from app.services.user_service import list_roles, list_departments, list_authors

router = APIRouter(prefix="/admin", tags=["admin-reference"])


@router.get("/roles")
def admin_list_roles(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return list_roles(db)


@router.get("/departments")
def admin_list_departments(
    _: User = Depends(require_authors_page_access),
    db: Session = Depends(get_db),
):
    return list_departments(db)


@router.get("/authors")
def admin_list_authors(
    available_only: bool = Query(default=False),
    user_id: int | None = Query(default=None),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return list_authors(db, available_only=available_only, user_id=user_id)
