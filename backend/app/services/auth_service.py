from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User
from app.security import verify_password, create_access_token


def serialize_auth_user(user: User) -> dict:
    author = user.author
    return {
        "id": user.id,
        "login": user.login,
        "full_name": user.full_name,
        "role_id": user.role_id,
        "role_name": user.role.name if user.role else None,
        "department_id": user.department_id,
        "department_name": user.department.DepartmentName if user.department else None,
        "author_id": user.author_id,
        "author_name": author.authorName if author else None,
        "position": author.position if author else None,
        "degree": author.degree if author else None,
        "rank": author.rank if author else None,
        "email": author.email if author else None,
        "type": author.type if author else None,
        "birthdate": author.birthdate.isoformat() if author and author.birthdate else None,
        "birth_year": author.year if author else None,
        "nickname": author.nickname if author else None,
        "status": author.status if author else None,
        "search_pattern": author.Pattern if author else None,
        "external_id": author.ID if author else None,
        "snils_last4": author.snils[-4:] if author and author.snils else None,
        "orcid": author.ORCID if author else None,
        "scopus_id": author.Scopus_ID if author else None,
        "wos_id": author.WOS_ID if author else None,
    }


def login_user(db: Session, username: str, password: str) -> dict:
    user = db.query(User).filter(User.login == username).first()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.login})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_auth_user(user),
    }
