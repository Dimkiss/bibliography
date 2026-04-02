from datetime import datetime

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.db import Base


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)

    users = relationship("User", back_populates="role")


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}

    DepartmentCode = Column(Integer, primary_key=True, index=True)
    DepartmentName = Column(String(100), nullable=False, unique=True)
    DepartmentNameEng = Column(String(128), nullable=False, default="")
    HeadOfLab = Column(Integer, ForeignKey("authors.authorID"), nullable=True)

    users = relationship("User", back_populates="department")


class Author(Base):
    __tablename__ = "authors"

    authorID = Column(Integer, primary_key=True, index=True)
    authorName = Column(String(100), nullable=False)

    users = relationship("User", back_populates="author")


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}

    id = Column(Integer, primary_key=True, index=True)
    login = Column(String(100), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)

    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.DepartmentCode"), nullable=False)
    author_id = Column(Integer, ForeignKey("authors.authorID"), nullable=True, unique=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    role = relationship("Role", back_populates="users")
    department = relationship("Department", back_populates="users")
    author = relationship("Author", back_populates="users")