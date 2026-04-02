from sqlalchemy.orm import Session

from app.models import Role, User, Department
from app.security import hash_password


def init_reference_data(db: Session) -> dict:
    roles = [
        (1, "Гость"),
        (2, "Сотрудник"),
        (3, "Руководитель подразделения"),
        (4, "Администрация"),
        (5, "Администратор"),
    ]

    for r_id, name in roles:
        existing_role = db.query(Role).filter(Role.id == r_id).first()
        if not existing_role:
            db.add(Role(id=r_id, name=name))

    db.commit()

    existing_user = db.query(User).filter(User.login == "dimkiss").first()
    if not existing_user:
        default_department = (
            db.query(Department)
            .filter(Department.DepartmentName == "Информационно-аналитический отдел")
            .first()
        )

        if not default_department:
            raise RuntimeError(
                "Department 'Информационно-аналитический отдел' not found in departments"
            )

        admin = User(
            login="dimkiss",
            full_name="Шергин Дмитрий Артемович",
            password_hash=hash_password("password"),
            role_id=5,
            department_id=default_department.DepartmentCode,
            author_id=None,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    return {"status": "ok"}