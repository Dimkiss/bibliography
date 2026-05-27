from pydantic import BaseModel, Field

from app.schemas.search_plan import SearchPlanRequest, SearchPlanResponse


class RagChunkMatch(BaseModel):
    article_id: int
    page_number: int
    chunk_index: int
    score: float
    text: str


class RagSearchRetrieval(BaseModel):
    status: str = "disabled"
    query: str | None = None
    article_ids: list[int] = Field(default_factory=list)
    matches: list[RagChunkMatch] = Field(default_factory=list)
    error: str | None = None


class RagSearchRequest(SearchPlanRequest):
    limit: int = Field(default=30, ge=1, le=100)


class RagSearchResponse(BaseModel):
    plan: SearchPlanResponse
    retrieval: RagSearchRetrieval
