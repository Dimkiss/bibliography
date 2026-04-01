from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


OriginalTranslationMode = Literal[
    "all",
    "original_only",
    "translation_only",
    "linked_only",
]


class ArticleListItem(BaseModel):
    id: int
    title: str | None = None
    authors: str | None = None
    journal: str | None = None
    year: int | None = None
    doi: str | None = None
    quartile: str | None = None
    quartile_scopus: str | None = None
    publication_types: list[str] = Field(default_factory=list)
    databases: list[str] = Field(default_factory=list)
    original_translation: str | None = None


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class ArticleListResponse(BaseModel):
    items: list[ArticleListItem]
    pagination: PaginationMeta


class PublicationTypeOption(BaseModel):
    value: str
    label: str


class DatabaseOption(BaseModel):
    value: str
    label: str


class ArticleFiltersResponse(BaseModel):
    year_min: int | None = None
    year_max: int | None = None
    publication_types: list[PublicationTypeOption] = Field(default_factory=list)
    databases: list[DatabaseOption] = Field(default_factory=list)
    original_translation_modes: list[dict[str, str]] = Field(default_factory=list)