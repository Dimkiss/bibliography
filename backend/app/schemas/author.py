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
