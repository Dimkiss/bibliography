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
    five_year_if: str | None = None
    scopus_quartile: str | None = None
    wos: bool = False
    scopus: bool = False
    rinc: bool = False
    rinc_core: bool = False
    rsci: bool = False
    foreign: bool = False
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


class PeriodicalEditionMetricPayload(BaseModel):
    j_id: int | None = Field(default=None, gt=0)
    year: int = Field(..., ge=0, le=9999)
    impact_factor: str | None = Field(default=None, max_length=32)
    five_year_if: str | None = Field(default=None, max_length=32)
    wos_quartile: str | None = Field(default=None, max_length=2)
    scopus_quartile: str | None = Field(default=None, max_length=2)
    white_list_level: int | None = Field(default=None, ge=0)
    wos: bool = False
    scopus: bool = False
    rinc: bool = False
    rinc_core: bool = False
    rsci: bool = False
    foreign: bool = False
    vak: bool = False


class PeriodicalEditionPayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    issn: str | None = Field(default=None, max_length=10)
    is_if: bool = False
    wos_name: str | None = Field(default=None, max_length=200)
    elibrary_name: str | None = Field(default=None, max_length=200)
    is_translation: bool = False
    comment: str | None = Field(default=None, max_length=200)
    metrics: list[PeriodicalEditionMetricPayload] = Field(default_factory=list)


class PeriodicalEditionMetricItem(BaseModel):
    j_id: int
    year: int
    impact_factor: str | None = None
    five_year_if: str | None = None
    wos_quartile: str | None = None
    scopus_quartile: str | None = None
    white_list_level: int | None = None
    wos: bool = False
    scopus: bool = False
    rinc: bool = False
    rinc_core: bool = False
    rsci: bool = False
    foreign: bool = False
    vak: bool = False


class PeriodicalEditionEditResponse(BaseModel):
    source_id: int
    title: str
    issn: str | None = None
    is_if: bool = False
    wos_name: str | None = None
    elibrary_name: str | None = None
    is_translation: bool = False
    comment: str | None = None
    metrics: list[PeriodicalEditionMetricItem] = Field(default_factory=list)
