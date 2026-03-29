from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies.auth import require_admin
from app.models import User
from app.schemas.user import UserCreate, UserUpdate
from app.services.user_service import (
    list_users,
    get_user_by_id,
    create_user,
    update_user,
    delete_user,
    unlink_user_author,
    serialize_user,
)

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


@router.get("")
def admin_list_users(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return list_users(db)


@router.get("/{user_id}")
def admin_get_user(
    user_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return serialize_user(get_user_by_id(db, user_id))


@router.post("", status_code=201)
def admin_create_user(
    payload: UserCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return create_user(db, payload)


@router.put("/{user_id}")
def admin_update_user(
    user_id: int,
    payload: UserUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return update_user(db, user_id, payload)


@router.delete("/{user_id}")
def admin_delete_user(
    user_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return delete_user(db, user_id, current_admin.id)


@router.delete("/{user_id}/author")
def admin_unlink_user_author(
    user_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return unlink_user_author(db, user_id)