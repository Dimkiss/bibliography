from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.article import PaginationMeta


EditionKind = Literal["periodical", "nonperiodical"]


class EditionFilterOption(BaseModel):
    value: str
    label: str


class EditionListItem(BaseModel):
    id: str
    source_id: int
    kind: EditionKind
    title: str | None = None
    identifier: str | None = None
    identifier_label: str
    year: int | None = None
    publication_type: str | None = None
    contributors: str | None = None
    contributors_label: str | None = None
    publisher: str | None = None
    place: str | None = None
    tirage: str | None = None
    white_list_level: str | None = None
    wos_quartile: str | None = None
    scopus_quartile: str | None = None
    rinc: bool = False
    vak: bool = False
    publication_count: int = 0


class EditionListResponse(BaseModel):
    items: list[EditionListItem]
    pagination: PaginationMeta


class EditionFiltersResponse(BaseModel):
    year_min: int | None = None
    year_max: int | None = None
    metric_levels: list[EditionFilterOption] = Field(default_factory=list)
    edition_types: list[EditionFilterOption] = Field(default_factory=list)
