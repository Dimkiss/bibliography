from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.article import PaginationMeta


EditionKind = Literal["periodical", "nonperiodical"]


class EditionFilterOption(BaseModel):
    value: str
    label: str


class EditionMetricHistoryItem(BaseModel):
    year: int
    value: str | None = None


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
    white_list_levels: list[EditionMetricHistoryItem] = Field(default_factory=list)
    wos_quartiles: list[EditionMetricHistoryItem] = Field(default_factory=list)
    scopus_quartiles: list[EditionMetricHistoryItem] = Field(default_factory=list)
    rinc: bool = False
    vak: bool = False
    publication_count: int = 0


class EditionDetailMetricItem(BaseModel):
    year: int
    white_list_level: str | None = None
    wos_quartile: str | None = None
    impact_factor: str | None = None
    scopus_quartile: str | None = None
    rinc: bool = False
    rinc_core: bool = False
    vak: bool = False


class EditionPublicationItem(BaseModel):
    id: int
    title: str | None = None
    authors: str | None = None
    doi: str | None = None
    year: int | None = None
    volume: str | None = None
    issue: str | None = None
    pages: str | None = None
    has_pdf: bool = False


class RelatedEditionItem(BaseModel):
    kind: EditionKind
    source_id: int
    title: str | None = None
    identifier: str | None = None


class EditionDetailResponse(BaseModel):
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
    date_of_meeting: str | None = None
    publisher: str | None = None
    place: str | None = None
    tirage: str | None = None
    insert_date: str | None = None
    metrics: list[EditionDetailMetricItem] = Field(default_factory=list)
    publications: list[EditionPublicationItem] = Field(default_factory=list)
    related_editions: list[RelatedEditionItem] = Field(default_factory=list)


class EditionListResponse(BaseModel):
    items: list[EditionListItem]
    pagination: PaginationMeta


class EditionFiltersResponse(BaseModel):
    year_min: int | None = None
    year_max: int | None = None
    metric_levels: list[EditionFilterOption] = Field(default_factory=list)
    edition_types: list[EditionFilterOption] = Field(default_factory=list)
