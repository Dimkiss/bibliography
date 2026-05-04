from sqlalchemy.orm import Session

from app.models import Role, User, Department
from app.roles import ADMIN_ROLE_ID, REQUIRED_ROLES
from app.security import hash_password


DEFAULT_ADMIN_LOGIN = "dimkiss"
DEFAULT_ADMIN_FULL_NAME = "Шергин Дмитрий Артемович"
DEFAULT_ADMIN_PASSWORD = "password"
DEFAULT_ADMIN_ROLE_ID = ADMIN_ROLE_ID
DEFAULT_ADMIN_DEPARTMENT_NAME = "Другое"


def ensure_roles(db: Session) -> int:
    created = 0

    for role_id, role_name in REQUIRED_ROLES:
        existing_role = db.query(Role).filter(Role.id == role_id).first()
        if existing_role is None:
            db.add(Role(id=role_id, name=role_name))
            created += 1

    db.commit()
    return created


def ensure_admin_user(db: Session) -> bool:
    existing_user = db.query(User).filter(User.login == DEFAULT_ADMIN_LOGIN).first()
    if existing_user is not None:
        return False

    default_department = (
        db.query(Department)
        .filter(Department.DepartmentName == DEFAULT_ADMIN_DEPARTMENT_NAME)
        .first()
    )
    if default_department is None:
        return False

    admin = User(
        login=DEFAULT_ADMIN_LOGIN,
        full_name=DEFAULT_ADMIN_FULL_NAME,
        password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
        role_id=DEFAULT_ADMIN_ROLE_ID,
        department_id=default_department.DepartmentCode,
        author_id=None,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    return True


def init_reference_data(db: Session) -> dict:
    roles_created = ensure_roles(db)
    admin_created = ensure_admin_user(db)

    return {
        "status": "ok",
        "roles_created": roles_created,
        "admin_created": admin_created,
        "admin_login": DEFAULT_ADMIN_LOGIN,
    }
