from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies.auth import get_current_user
from app.models import User
from app.services.auth_service import login_user, serialize_auth_user

router = APIRouter(tags=["auth"])


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    return login_user(db, form_data.username, form_data.password)


@router.get("/me")
def read_me(current_user: User = Depends(get_current_user)):
    return serialize_auth_user(current_user)
