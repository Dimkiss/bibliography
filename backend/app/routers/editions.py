from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.edition import EditionFiltersResponse, EditionListResponse
from app.services import editions as edition_service

router = APIRouter(prefix="/editions", tags=["editions"])


@router.get("", response_model=EditionListResponse)
def list_editions(
    kind: str = Query("periodical"),
    page: int = Query(1, ge=1),
    page_size: int = Query(
        edition_service.DEFAULT_PAGE_SIZE,
        ge=1,
        le=edition_service.MAX_PAGE_SIZE,
    ),
    query: str | None = Query(None),
    year_from: int | None = Query(None, ge=0),
    year_to: int | None = Query(None, ge=0),
    metric_levels: list[str] | None = Query(None),
    edition_types: list[str] | None = Query(None),
    sort_by: str = Query("title"),
    sort_order: str = Query("asc"),
    include_total: bool = Query(True),
    known_total: int | None = Query(None, ge=0),
    db: Session = Depends(get_db),
) -> EditionListResponse:
    return edition_service.list_editions(
        db=db,
        kind=kind,
        page=page,
        page_size=page_size,
        query=query,
        year_from=year_from,
        year_to=year_to,
        metric_levels=metric_levels,
        edition_types=edition_types,
        sort_by=sort_by,
        sort_order=sort_order,
        include_total=include_total,
        known_total=known_total,
    )


@router.get("/filters", response_model=EditionFiltersResponse)
def get_edition_filters(db: Session = Depends(get_db)) -> EditionFiltersResponse:
    return edition_service.get_edition_filters(db)
