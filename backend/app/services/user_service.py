from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import User, Role, Department, Author
from app.schemas.user import UserCreate, UserUpdate
from app.security import hash_password


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "login": user.login,
        "full_name": user.full_name,
        "role_id": user.role_id,
        "role_name": user.role.name if user.role else None,
        "department_id": user.department_id,
        "department_name": user.department.name if user.department else None,
        "author_id": user.author_id,
        "author_name": user.author.authorName if user.author else None,
        "created_at": user.created_at,
    }


def list_users(db: Session) -> list[dict]:
    return [serialize_user(user) for user in db.query(User).all()]


def get_user_by_id(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def create_user(db: Session, payload: UserCreate) -> dict:
    if db.query(User).filter(User.login == payload.login).first():
        raise HTTPException(status_code=400, detail="Login already exists")

    role = db.query(Role).filter(Role.id == payload.role_id).first()
    if not role:
        raise HTTPException(status_code=400, detail="Role not found")

    department = db.query(Department).filter(Department.id == payload.department_id).first()
    if not department:
        raise HTTPException(status_code=400, detail="Department not found")

    if payload.author_id is not None:
        author = db.query(Author).filter(Author.authorID == payload.author_id).first()
        if not author:
            raise HTTPException(status_code=400, detail="Author not found")

        if db.query(User).filter(User.author_id == payload.author_id).first():
            raise HTTPException(status_code=400, detail="Author is already linked to another user")

    user = User(
        login=payload.login,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role_id=payload.role_id,
        department_id=payload.department_id,
        author_id=payload.author_id,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


def update_user(db: Session, user_id: int, payload: UserUpdate) -> dict:
    user = get_user_by_id(db, user_id)

    if payload.login is not None and payload.login != user.login:
        if db.query(User).filter(User.login == payload.login).first():
            raise HTTPException(status_code=400, detail="Login already exists")
        user.login = payload.login

    if payload.full_name is not None:
        user.full_name = payload.full_name

    if payload.password is not None:
        user.password_hash = hash_password(payload.password)

    if payload.role_id is not None:
        role = db.query(Role).filter(Role.id == payload.role_id).first()
        if not role:
            raise HTTPException(status_code=400, detail="Role not found")
        user.role_id = payload.role_id

    if payload.department_id is not None:
        department = db.query(Department).filter(Department.id == payload.department_id).first()
        if not department:
            raise HTTPException(status_code=400, detail="Department not found")
        user.department_id = payload.department_id

    if payload.author_id is not None and payload.author_id != user.author_id:
        author = db.query(Author).filter(Author.authorID == payload.author_id).first()
        if not author:
            raise HTTPException(status_code=400, detail="Author not found")

        existing_user = (
            db.query(User)
            .filter(User.author_id == payload.author_id, User.id != user.id)
            .first()
        )
        if existing_user:
            raise HTTPException(status_code=400, detail="Author is already linked to another user")

        user.author_id = payload.author_id

    db.commit()
    db.refresh(user)
    return serialize_user(user)


def delete_user(db: Session, user_id: int, current_admin_id: int) -> dict:
    user = get_user_by_id(db, user_id)

    if user.id == current_admin_id:
        raise HTTPException(status_code=400, detail="You cannot delete yourself")

    db.delete(user)
    db.commit()
    return {"status": "deleted"}


def unlink_user_author(db: Session, user_id: int) -> dict:
    user = get_user_by_id(db, user_id)
    user.author_id = None
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "login": user.login,
        "author_id": user.author_id,
    }