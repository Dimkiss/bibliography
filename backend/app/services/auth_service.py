from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User
from app.security import verify_password, create_access_token


def login_user(db: Session, username: str, password: str) -> dict:
    user = db.query(User).filter(User.login == username).first()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid login or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.login})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "login": user.login,
            "full_name": user.full_name,
            "role_id": user.role_id,
            "department_id": user.department_id,
            "author_id": user.author_id,
        },
    }