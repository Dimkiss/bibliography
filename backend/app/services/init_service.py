from sqlalchemy.orm import Session

from app.models import Role, Department, User
from app.security import hash_password


def init_reference_data(db: Session) -> dict:
    roles = [
        (1, "Гость"),
        (2, "Сотрудник"),
        (3, "Руководитель подразделения"),
        (4, "Администрация"),
        (5, "Администратор"),
    ]

    departments = [
        (1, "Лаборатория ультраструктуры микроводорослей"),
        (2, "Лаборатория водной микробиологии"),
        (3, "Лаборатория микробиологии углеводородов"),
        (4, "Лаборатория гидрологии и гидрофизики"),
        (5, "Лаборатория гидрохимии и химии атмосферы"),
        (6, "Лаборатория геносистематики"),
        (7, "Лаборатория палеолимнологии"),
        (8, "Лаборатория биологии водных беспозвоночных"),
        (9, "Группа экспериментальной гидробиологии"),
        (10, "Лаборатория ихтиологии"),
        (11, "Лаборатория аналитической биоорганической химии"),
        (12, "Лаборатория хроматографии"),
        (13, "Лаборатория геологии оз. Байкал"),
        (14, "Лаборатория биомолекулярных систем"),
        (15, "Лаборатория междисциплинарных эколого-экономических исследований и технологий"),
        (16, "Информационно-аналитический отдел"),
        (17, "Отдел по международным связям"),
    ]

    for r_id, name in roles:
        existing_role = db.query(Role).filter(Role.id == r_id).first()
        if not existing_role:
            db.add(Role(id=r_id, name=name))

    for d_id, name in departments:
        existing_department = db.query(Department).filter(Department.id == d_id).first()
        if not existing_department:
            db.add(Department(id=d_id, name=name))

    db.commit()

    existing_user = db.query(User).filter(User.login == "dimkiss").first()
    if not existing_user:
        admin = User(
            login="dimkiss",
            full_name="Шергин Дмитрий Артемович",
            password_hash=hash_password("password"),
            role_id=5,
            department_id=16,
            author_id=None,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    return {"status": "ok"}