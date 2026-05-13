from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


OriginalTranslationMode = Literal[
    "all",
    "original_only",
    "translation_only",
]


class ArticleListItem(BaseModel):
    id: int
    title: str | None = None
    authors: str | None = None
    journal: str | None = None
    year: int | None = None
    doi: str | None = None
    bibliographic_reference: str = ""
    quartile: str | None = None
    quartile_scopus: str | None = None
    publication_types: list[str] = Field(default_factory=list)
    databases: list[str] = Field(default_factory=list)
    original_translation: str | None = None
    has_pdf: bool = False


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


class ArticleMetricItem(BaseModel):
    label: str
    value: str | None = None
    extra: str | None = None
    enabled: bool = False


class RelatedArticleItem(BaseModel):
    id: int
    title: str | None = None
    authors: str | None = None
    journal: str | None = None
    year: int | None = None
    doi: str | None = None
    relation_type: Literal["original", "translation"]
    has_pdf: bool = False


class ArticleDetailResponse(BaseModel):
    id: int
    title: str | None = None
    authors: str | None = None
    abstract: str | None = None
    doi: str | None = None
    bibliographic_reference: str = ""
    journal: str | None = None
    edition_kind: Literal["periodical", "nonperiodical"] | None = None
    edition_source_id: int | None = None
    year: int | None = None
    volume: str | None = None
    issue: str | None = None
    pages: str | None = None
    publication_date: str | None = None
    insert_date: str | None = None
    publication_types: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    metrics: list[ArticleMetricItem] = Field(default_factory=list)
    related_articles: list[RelatedArticleItem] = Field(default_factory=list)
    has_pdf: bool = False


class JournalOptionItem(BaseModel):
    id: int
    label: str
    journal_name: str | None = None
    year: int | None = None
    quartile: str | None = None
    quartile_scopus: str | None = None


class JournalOptionListResponse(BaseModel):
    items: list[JournalOptionItem]
    pagination: PaginationMeta


class KeywordOptionItem(BaseModel):
    id: int
    label: str


class KeywordOptionListResponse(BaseModel):
    items: list[KeywordOptionItem]
    pagination: PaginationMeta


class WorkFormTypeOption(BaseModel):
    value: str
    label: str | None = None
    label_ru: str | None = None


class PlaceOptionItem(BaseModel):
    id: int
    label: str


class PlaceOptionListResponse(BaseModel):
    items: list[PlaceOptionItem]
    pagination: PaginationMeta


class PublisherOptionItem(BaseModel):
    id: int
    label: str


class PublisherOptionListResponse(BaseModel):
    items: list[PublisherOptionItem]
    pagination: PaginationMeta


class MediumDesignatorOptionItem(BaseModel):
    id: int
    label: str


class MediumDesignatorOptionListResponse(BaseModel):
    items: list[MediumDesignatorOptionItem]
    pagination: PaginationMeta


class DepartmentOptionItem(BaseModel):
    id: int
    label: str
    label_eng: str | None = None


class DepartmentOptionListResponse(BaseModel):
    items: list[DepartmentOptionItem]
    pagination: PaginationMeta


class WorkFormFieldItem(BaseModel):
    article_field: str | None = None
    label: str | None = None
    foreign_table_name: str | None = None
    field_height: int | None = None
    not_in_articles_field: bool = False


class ArticleSearchItem(BaseModel):
    id: int
    title: str | None = None
    authors: str | None = None
    journal: str | None = None
    year: int | None = None
    doi: str | None = None


class ArticleSearchResponse(BaseModel):
    items: list[ArticleSearchItem]
    pagination: PaginationMeta


class AuthorOptionItem(BaseModel):
    id: int | None = None
    label: str
    source: Literal["employee", "publication_author"] = "employee"
    nickname: str | None = None
    email: str | None = None
    position: str | None = None
    department_id: int | None = None
    department_name: str | None = None


class AuthorOptionListResponse(BaseModel):
    items: list[AuthorOptionItem]
    pagination: PaginationMeta


class SelectedAuthorPayload(BaseModel):
    author_id: int = Field(..., gt=0)
    affiliation: int = Field(default=1, ge=1, le=9)
    corresponding_author: bool = False


class SelectedAuthorItem(BaseModel):
    author_id: int
    author_name: str
    affiliation: int = 1
    corresponding_author: bool = False


class ArticleEditResponse(BaseModel):
    id: int
    title: str | None = None
    year: int | None = None

    authors_text: str | None = None
    authors: list[SelectedAuthorItem] = Field(default_factory=list)
    author_role: str | None = None
    abstract: str | None = None
    doi: str | None = None

    journal_id: int | None = None
    edition: str | None = None
    work_form_type: str | None = None
    medium_designator_id: int | None = None

    author_of_material: str | None = None
    title_of_material: str | None = None
    date_of_meeting: str | None = None
    place_of_meeting_id: int | None = None

    place_of_publication_id: int | None = None
    publisher_id: int | None = None
    publication_date: str | None = None

    volume: str | None = None
    issue: str | None = None
    pages: str | None = None
    extent_of_work: str | None = None

    url: str | None = None
    issn: str | None = None
    isbn: str | None = None
    notes: str | None = None
    speaker: str | None = None

    publication_type_flags: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    department_codes: list[int] = Field(default_factory=list)

    original_version_id: int | None = None
    translation_version_id: int | None = None
    article_language: str | None = None
    tirage: str | None = None
    wos_excluded: bool | None = None
    scopus_excluded: bool | None = None

    num_foreigners: int | None = None
    ship: str | None = None


class ArticleCreatePayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=1000)
    year: int = Field(..., ge=0, le=9999)

    authors_text: str | None = Field(default=None, max_length=2000)
    authors: list[SelectedAuthorPayload] = Field(default_factory=list)
    author_role: str | None = Field(default=None, max_length=500)
    abstract: str | None = Field(default=None, max_length=4000)
    doi: str | None = Field(default=None, max_length=200)

    journal_id: int | None = None
    edition: str | None = Field(default=None, max_length=500)
    work_form_type: str | None = Field(default="J", min_length=1, max_length=1)
    medium_designator_id: int | None = None

    author_of_material: str | None = Field(default=None, max_length=2000)
    title_of_material: str | None = Field(default=None, max_length=1000)
    date_of_meeting: str | None = Field(default=None, max_length=100)
    place_of_meeting_id: int | None = None

    place_of_publication_id: int | None = None
    publisher_id: int | None = None
    publication_date: date | None = None

    volume: str | None = Field(default=None, max_length=1000)
    issue: str | None = Field(default=None, max_length=500)
    pages: str | None = Field(default=None, max_length=500)
    extent_of_work: str | None = Field(default=None, max_length=300)

    url: str | None = Field(default=None, max_length=500)
    issn: str | None = Field(default=None, max_length=100)
    isbn: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)
    speaker: str | None = Field(default=None, max_length=100)

    publication_type_flags: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    department_codes: list[int] = Field(default_factory=list)

    original_version_id: int | None = None
    translation_version_id: int | None = None
    article_language: str | None = Field(default=None, max_length=1)
    tirage: str | None = Field(default=None, max_length=50)
    wos_excluded: bool | None = None
    scopus_excluded: bool | None = None

    num_foreigners: int | None = Field(default=None, ge=0)
    ship: str | None = Field(default=None, max_length=250)


class ArticleUpdatePayload(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=1000)
    year: int | None = Field(default=None, ge=0, le=9999)

    authors_text: str | None = Field(default=None, max_length=2000)
    authors: list[SelectedAuthorPayload] | None = None
    author_role: str | None = Field(default=None, max_length=500)
    abstract: str | None = Field(default=None, max_length=4000)
    doi: str | None = Field(default=None, max_length=200)

    journal_id: int | None = None
    edition: str | None = Field(default=None, max_length=500)
    work_form_type: str | None = Field(default=None, min_length=1, max_length=1)
    medium_designator_id: int | None = None

    author_of_material: str | None = Field(default=None, max_length=2000)
    title_of_material: str | None = Field(default=None, max_length=1000)
    date_of_meeting: str | None = Field(default=None, max_length=100)
    place_of_meeting_id: int | None = None

    place_of_publication_id: int | None = None
    publisher_id: int | None = None
    publication_date: date | None = None

    volume: str | None = Field(default=None, max_length=1000)
    issue: str | None = Field(default=None, max_length=500)
    pages: str | None = Field(default=None, max_length=500)
    extent_of_work: str | None = Field(default=None, max_length=300)

    url: str | None = Field(default=None, max_length=500)
    issn: str | None = Field(default=None, max_length=100)
    isbn: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)
    speaker: str | None = Field(default=None, max_length=100)

    publication_type_flags: list[str] | None = None
    keywords: list[str] | None = None
    department_codes: list[int] | None = None

    original_version_id: int | None = None
    translation_version_id: int | None = None
    article_language: str | None = Field(default=None, max_length=1)
    tirage: str | None = Field(default=None, max_length=50)
    wos_excluded: bool | None = None
    scopus_excluded: bool | None = None

    num_foreigners: int | None = Field(default=None, ge=0)
    ship: str | None = Field(default=None, max_length=250)
