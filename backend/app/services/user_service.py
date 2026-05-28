from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import User, Role, Department, Author
from app.schemas.user import UserCreate, UserUpdate
from app.security import hash_password


def _is_field_provided(payload, field_name: str) -> bool:
    if hasattr(payload, "model_fields_set"):
        return field_name in payload.model_fields_set
    return field_name in getattr(payload, "__fields_set__", set())


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "login": user.login,
        "full_name": user.full_name,
        "role_id": user.role_id,
        "role_name": user.role.name if user.role else None,
        "department_id": user.department_id,
        "department_name": user.department.DepartmentName if user.department else None,
        "author_id": user.author_id,
        "author_name": user.author.authorName if user.author else None,
        "created_at": user.created_at,
    }


def serialize_role(role: Role) -> dict:
    return {
        "id": role.id,
        "name": role.name,
    }


def serialize_department(department: Department) -> dict:
    return {
        "id": department.DepartmentCode,
        "name": department.DepartmentName,
        "name_eng": department.DepartmentNameEng,
    }


def serialize_author(author: Author) -> dict:
    linked_user = author.users[0] if author.users else None
    return {
        "id": author.authorID,
        "name": author.authorName,
        "department_id": author.DepartmentCode,
        "linked_user_id": linked_user.id if linked_user else None,
        "linked_user_login": linked_user.login if linked_user else None,
        "is_available": linked_user is None,
    }


def list_users(db: Session) -> list[dict]:
    users = db.query(User).order_by(User.id.asc()).all()
    return [serialize_user(user) for user in users]


def list_roles(db: Session) -> list[dict]:
    roles = db.query(Role).order_by(Role.id.asc()).all()
    return [serialize_role(role) for role in roles]


def list_departments(db: Session) -> list[dict]:
    departments = db.query(Department).order_by(Department.DepartmentName.asc()).all()
    return [serialize_department(department) for department in departments]


def list_authors(
    db: Session,
    available_only: bool = False,
    user_id: int | None = None,
) -> list[dict]:
    current_user = get_user_by_id(db, user_id) if user_id is not None else None

    authors = db.query(Author).order_by(Author.authorName.asc()).all()
    result: list[dict] = []

    for author in authors:
        serialized = serialize_author(author)
        is_current_user_author = (
            current_user is not None and current_user.author_id == serialized["id"]
        )

        if available_only and not serialized["is_available"] and not is_current_user_author:
            continue

        result.append(serialized)

    return result


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

    department = (
        db.query(Department)
        .filter(Department.DepartmentCode == payload.department_id)
        .first()
    )
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
        department = (
            db.query(Department)
            .filter(Department.DepartmentCode == payload.department_id)
            .first()
        )
        if not department:
            raise HTTPException(status_code=400, detail="Department not found")
        user.department_id = payload.department_id

    if _is_field_provided(payload, "author_id"):
        if payload.author_id is None:
            user.author_id = None
        elif payload.author_id != user.author_id:
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
