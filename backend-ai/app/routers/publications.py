from fastapi import APIRouter

from app.schemas.search_plan import SearchPlanRequest, SearchPlanResponse
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
