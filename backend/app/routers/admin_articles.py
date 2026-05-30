from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies.auth import require_admin
from app.models import User
from app.schemas.article import (
    ArticleCreatePayload,
    ArticleEditResponse,
    ArticleSearchResponse,
    ArticleUpdatePayload,
    AuthorOptionListResponse,
    DepartmentOptionListResponse,
    JournalOptionListResponse,
    KeywordOptionListResponse,
    MediumDesignatorOptionListResponse,
    PlaceOptionListResponse,
    PublicationTypeOption,
    PublisherOptionListResponse,
    WorkFormFieldItem,
    WorkFormTypeOption,
)
from app.routers.ai import trigger_article_pdf_indexing
from app.services.articles import admin as article_admin
from app.services.articles import pdf_files
from app.services.articles.exceptions import (
    ArticleConflictError,
    ArticleNotFoundError,
    ArticleValidationError,
)
from app.services.articles import lookups as article_lookups

router = APIRouter(prefix="/admin", tags=["admin-articles"])

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 1000




@router.get("/article-authors", response_model=AuthorOptionListResponse)
def admin_list_article_authors(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    all: bool = Query(default=False),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return article_lookups.list_article_authors(
        db=db,
        search=search,
        page=page,
        page_size=page_size,
        all_items=all,
    )


@router.get("/journals", response_model=JournalOptionListResponse)
def admin_list_journals(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    all: bool = Query(default=False),
    include_total: bool = Query(default=True),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return article_lookups.list_journals(
        db=db,
        search=search,
        page=page,
        page_size=page_size,
        all_items=all,
        include_total=include_total,
    )

@router.get("/publication-types", response_model=list[PublicationTypeOption])
def admin_list_publication_types(
    work_form_type: str | None = Query(default=None),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return article_lookups.list_publication_types(
        db=db,
        work_form_type=work_form_type,
    )

@router.get("/work-form-types", response_model=list[WorkFormTypeOption])
def admin_list_work_form_types(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return article_lookups.list_work_form_types(db)

@router.get("/work-form-fields", response_model=list[WorkFormFieldItem])
def admin_list_work_form_fields(
    work_form_type: str = Query(..., min_length=1, max_length=1),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return article_lookups.list_work_form_fields(
        db=db,
        work_form_type=work_form_type,
    )

@router.get("/keywords", response_model=KeywordOptionListResponse)
def admin_list_keywords(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    all: bool = Query(default=False),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return article_lookups.list_keywords(
        db=db,
        search=search,
        page=page,
        page_size=page_size,
        all_items=all,
    )

@router.get("/places", response_model=PlaceOptionListResponse)
def admin_list_places(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    all: bool = Query(default=False),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return article_lookups.list_places(
        db=db,
        search=search,
        page=page,
        page_size=page_size,
        all_items=all,
    )

@router.get("/publishers", response_model=PublisherOptionListResponse)
def admin_list_publishers(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    all: bool = Query(default=False),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return article_lookups.list_publishers(
        db=db,
        search=search,
        page=page,
        page_size=page_size,
        all_items=all,
    )

@router.get("/medium-designators", response_model=MediumDesignatorOptionListResponse)
def admin_list_medium_designators(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    all: bool = Query(default=False),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return article_lookups.list_medium_designators(
        db=db,
        search=search,
        page=page,
        page_size=page_size,
        all_items=all,
    )

@router.get("/article-departments", response_model=DepartmentOptionListResponse)
def admin_list_article_departments(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    all: bool = Query(default=False),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return article_lookups.list_article_departments(
        db=db,
        search=search,
        page=page,
        page_size=page_size,
        all_items=all,
    )

@router.get("/articles/search", response_model=ArticleSearchResponse)
def admin_search_articles(
    query: str | None = Query(default=None),
    exclude_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    all: bool = Query(default=False),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return article_admin.search_articles(
        db=db,
        query=query,
        exclude_id=exclude_id,
        page=page,
        page_size=page_size,
        all_items=all,
    )

@router.get("/articles/{article_id}/edit", response_model=ArticleEditResponse)
def admin_get_article_for_edit(
    article_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        return article_admin.get_article_for_edit(db=db, article_id=article_id)
    except article_admin.ArticleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

@router.post("/articles", status_code=status.HTTP_201_CREATED)
def admin_create_article(
    payload: ArticleCreatePayload,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        return article_admin.create_article(db=db, payload=payload)
    except ArticleValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ArticleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ArticleConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/articles/{article_id}/pdf")
def admin_upload_article_pdf(
    article_id: int,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = ...,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if file.content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed.",
        )

    try:
        article_admin.get_article_for_edit(db=db, article_id=article_id)
    except ArticleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    pdf_files.save_article_pdf(article_id, file)
    background_tasks.add_task(trigger_article_pdf_indexing, article_id)
    return {"article_id": article_id, "has_pdf": True}


@router.put("/articles/{article_id}")
def admin_update_article(
    article_id: int,
    payload: ArticleUpdatePayload,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        return article_admin.update_article(
            db=db,
            article_id=article_id,
            payload=payload,
        )
    except ArticleValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ArticleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ArticleConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

@router.delete("/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_article(
    article_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        article_admin.delete_article(db=db, article_id=article_id)
    except ArticleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ArticleConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
