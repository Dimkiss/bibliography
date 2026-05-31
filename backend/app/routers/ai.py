import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.dependencies.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/ai", tags=["ai"])

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://ai-agent:8001")
_TIMEOUT = 120.0
_INDEX_TIMEOUT = 300.0  # индексация PDF может занять несколько минут


async def _proxy_post(path: str, request: Request) -> dict:
    body = await request.body()
    url = f"{AI_SERVICE_URL}{path}"

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.post(
                url,
                content=body,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service unavailable",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI service timeout",
        )

    if not response.is_success:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()


def trigger_article_pdf_indexing(article_id: int) -> None:
    """
    Fire-and-forget: вызывается из BackgroundTask после сохранения PDF.
    Ошибки не пробрасываются — основной запрос не должен зависеть от индексации.
    """
    url = f"{AI_SERVICE_URL}/ai/publications/index/article/{article_id}"
    try:
        with httpx.Client(timeout=_INDEX_TIMEOUT) as client:
            client.post(url)
    except Exception:
        pass


@router.post("/publications/search-plan")
async def proxy_search_plan(
    request: Request,
    _current_user: User = Depends(get_current_user),
):
    return await _proxy_post("/ai/publications/search-plan", request)


@router.post("/publications/rag-search")
async def proxy_rag_search(
    request: Request,
    _current_user: User = Depends(get_current_user),
):
    return await _proxy_post("/ai/publications/rag-search", request)
