from typing import Literal

from pydantic import BaseModel, Field


class SearchPlanFilters(BaseModel):
    text_query: str | None = None
    refine_text_query: str | None = None
    title: str | None = None
    author: str | None = None
    journal: str | None = None
    keyword: list[str] = Field(default_factory=list)
    year_from: int | None = None
    year_to: int | None = None
    publication_types: list[str] = Field(default_factory=list)
    databases: list[str] = Field(default_factory=list)
    original_translation_mode: Literal[
        "all",
        "original_only",
        "translation_only",
    ] = "all"
    article_ids: list[int] = Field(default_factory=list)


class SearchPlanRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    current_filters: SearchPlanFilters | None = None


class SearchPlanSemantic(BaseModel):
    query: str | None = None
    scope: Literal["metadata", "pdf", "metadata_and_pdf"] = "metadata"


class SearchPlanSort(BaseModel):
    by: Literal["authors", "title", "journal", "year", "doi", "quartile", "relevance"] = "year"
    order: Literal["asc", "desc"] = "desc"


class SearchPlanResponse(BaseModel):
    intent: Literal["search", "clarify"] = "search"
    explanation: str
    filters: SearchPlanFilters
    semantic: SearchPlanSemantic = Field(default_factory=SearchPlanSemantic)
    sort: SearchPlanSort = Field(default_factory=SearchPlanSort)
