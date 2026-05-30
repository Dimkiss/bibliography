from fastapi import APIRouter

from app.schemas.rag_search import RagSearchRequest, RagSearchResponse
from app.schemas.search_plan import SearchPlanRequest, SearchPlanResponse
from app.services.rag_search import build_rag_search
from app.services.search_planner import build_search_plan


router = APIRouter(prefix="/ai/publications", tags=["ai-publications"])


@router.post("/search-plan", response_model=SearchPlanResponse)
def create_publication_search_plan(
    payload: SearchPlanRequest,
) -> SearchPlanResponse:
    return build_search_plan(
        payload.message,
        current_filters=payload.current_filters,
    )


@router.post("/rag-search", response_model=RagSearchResponse)
def create_publication_rag_search(
    payload: RagSearchRequest,
) -> RagSearchResponse:
    return build_rag_search(
        payload.message,
        current_filters=payload.current_filters,
        limit=payload.limit,
    )


@router.post("/index/article/{article_id}")
def index_article_pdf(article_id: int) -> dict:
    """Индексирует PDF одной статьи в Qdrant. Запускается после загрузки/обновления PDF."""
    from app.services.pdf_indexer import index_article_pdf as _index  # noqa: PLC0415

    return _index(article_id)
