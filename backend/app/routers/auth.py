from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies.auth import get_current_user
from app.models import User
from app.services.auth_service import login_user

router = APIRouter(tags=["auth"])


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    return login_user(db, form_data.username, form_data.password)


@router.get("/me")
def read_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "login": current_user.login,
        "full_name": current_user.full_name,
        "role_id": current_user.role_id,
        "role_name": current_user.role.name if current_user.role else None,
        "department_id": current_user.department_id,
        "department_name": current_user.department.DepartmentName if current_user.department else None,
        "author_id": current_user.author_id,
        "author_name": current_user.author.authorName if current_user.author else None,
        "position": current_user.author.position if current_user.author else None,
        "degree": current_user.author.degree if current_user.author else None,
        "rank": current_user.author.rank if current_user.author else None,
        "email": current_user.author.email if current_user.author else None,
        "orcid": current_user.author.ORCID if current_user.author else None,
        "scopus_id": current_user.author.Scopus_ID if current_user.author else None,
        "wos_id": current_user.author.WOS_ID if current_user.author else None,
    }