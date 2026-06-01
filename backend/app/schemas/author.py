from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class AuthorCreate(BaseModel):
    authorName: str = Field(..., min_length=1, max_length=100)
    position: Optional[str] = Field(default=None, max_length=100)
    degree: Optional[str] = Field(default=None, max_length=50)
    rank: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=50)
    WOS_ID: Optional[str] = Field(default=None, max_length=100)
    Scopus_ID: Optional[str] = Field(default=None, max_length=20)
    ORCID: Optional[str] = Field(default=None, max_length=100)
    DepartmentCode: Optional[int] = None
    type: Optional[str] = Field(default=None, max_length=4)
    birthdate: Optional[date] = None
    birth_year: Optional[int] = Field(default=None, ge=1900, le=2100)
    nickname: Optional[str] = Field(default=None, max_length=200)
    status: Optional[int] = Field(default=None, ge=0, le=2)
    search_pattern: Optional[str] = Field(default=None, max_length=50)
    external_id: Optional[int] = None


class AuthorUpdate(BaseModel):
    authorName: Optional[str] = Field(default=None, min_length=1, max_length=100)
    position: Optional[str] = Field(default=None, max_length=100)
    degree: Optional[str] = Field(default=None, max_length=50)
    rank: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=50)
    WOS_ID: Optional[str] = Field(default=None, max_length=100)
    Scopus_ID: Optional[str] = Field(default=None, max_length=20)
    ORCID: Optional[str] = Field(default=None, max_length=100)
    DepartmentCode: Optional[int] = None
    type: Optional[str] = Field(default=None, max_length=4)
    birthdate: Optional[date] = None
    birth_year: Optional[int] = Field(default=None, ge=1900, le=2100)
    nickname: Optional[str] = Field(default=None, max_length=200)
    status: Optional[int] = Field(default=None, ge=0, le=2)
    search_pattern: Optional[str] = Field(default=None, max_length=50)
    external_id: Optional[int] = None
