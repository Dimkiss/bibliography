from typing import Optional
from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    login: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1, max_length=255)
    role_id: int
    department_id: int
    author_id: Optional[int] = None


class UserUpdate(BaseModel):
    login: Optional[str] = Field(default=None, min_length=1, max_length=100)
    password: Optional[str] = Field(default=None, min_length=8)
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    role_id: Optional[int] = None
    department_id: Optional[int] = None
    author_id: Optional[int] = None