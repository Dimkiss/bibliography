from datetime import datetime

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, BigInteger, Index
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
    position = Column(String(100), nullable=True)
    degree = Column(String(50), nullable=True)
    rank = Column(String(50), nullable=True)
    email = Column(String(50), nullable=True)
    WOS_ID = Column(String(100), nullable=True)
    Scopus_ID = Column(String(20), nullable=True)
    ORCID = Column(String(100), nullable=True)
    DepartmentCode = Column(Integer, ForeignKey("departments.DepartmentCode"), nullable=True)

    users = relationship("User", back_populates="author")
    department = relationship("Department", foreign_keys=[DepartmentCode], primaryjoin="Author.DepartmentCode == Department.DepartmentCode")


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


class PdfIndexStatus(Base):
    __tablename__ = "pdf_index_status"
    __table_args__ = (
        Index("ix_pdf_index_status_status", "status"),
        {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    article_id = Column(Integer, primary_key=True, index=True)
    pdf_sha1 = Column(String(40), nullable=True, index=True)
    status = Column(String(32), nullable=False)
    pages_count = Column(Integer, nullable=False, default=0)
    chunks_count = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    indexed_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class PdfTextChunk(Base):
    __tablename__ = "pdf_text_chunks"
    __table_args__ = (
        Index("ix_pdf_text_chunks_article_page", "article_id", "page_number"),
        Index("ix_pdf_text_chunks_sha1", "pdf_sha1"),
        {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    article_id = Column(Integer, nullable=False, index=True)
    pdf_sha1 = Column(String(40), nullable=False)
    page_number = Column(Integer, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    text_length = Column(Integer, nullable=False, default=0)
