from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.article import (
    ArticleDetailResponse,
    ArticleFiltersResponse,
    ArticleListResponse,
)
from app.services.articles import public as article_service
from app.services.articles import pdf_files

router = APIRouter(prefix="/articles", tags=["articles"])


@router.get("", response_model=ArticleListResponse)
def list_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(
        article_service.DEFAULT_PAGE_SIZE,
        ge=1,
        le=article_service.MAX_PAGE_SIZE,
    ),
    text_query: str | None = Query(None),
    title: str | None = Query(None),
    author: str | None = Query(None),
    journal: str | None = Query(None),
    keyword: list[str] | None = Query(None),
    year_from: int | None = Query(None, ge=0),
    year_to: int | None = Query(None, ge=0),
    publication_types: list[str] | None = Query(None),
    databases: list[str] | None = Query(None),
    article_ids: list[int] | None = Query(None),
    original_translation_mode: str = Query("all"),
    sort_by: str = Query("year"),
    sort_order: str = Query("desc"),
    include_total: bool = Query(True),
    known_total: int | None = Query(None, ge=0),
    db: Session = Depends(get_db),
) -> ArticleListResponse:
    return article_service.list_articles(
        db=db,
        page=page,
        page_size=page_size,
        text_query=text_query,
        title=title,
        author=author,
        journal=journal,
        keyword=keyword,
        year_from=year_from,
        year_to=year_to,
        publication_types=publication_types,
        databases=databases,
        article_ids=article_ids,
        original_translation_mode=original_translation_mode,
        sort_by=sort_by,
        sort_order=sort_order,
        include_total=include_total,
        known_total=known_total,
    )


@router.get("/filters", response_model=ArticleFiltersResponse)
def get_article_filters(db: Session = Depends(get_db)) -> ArticleFiltersResponse:
    return article_service.get_article_filters(db)


@router.get("/latest")
def get_latest_articles(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    return article_service.get_latest_articles(db=db, limit=limit)


@router.get("/{article_id}/pdf")
def download_article_pdf(
    article_id: int,
    db: Session = Depends(get_db),
) -> FileResponse:
    try:
        article_service.get_article_detail(article_id=article_id, db=db)
    except article_service.ArticleNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    pdf_path = pdf_files.get_pdf_path(article_id)
    if not pdf_path.is_file():
        raise HTTPException(status_code=404, detail="PDF file not found.")

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"article-{article_id}.pdf",
    )


@router.get("/{article_id}", response_model=ArticleDetailResponse)
def get_article_detail(
    article_id: int,
    db: Session = Depends(get_db),
) -> ArticleDetailResponse:
    try:
        return article_service.get_article_detail(article_id=article_id, db=db)
    except article_service.ArticleNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
