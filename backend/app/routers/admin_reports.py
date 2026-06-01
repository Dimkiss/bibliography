from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies.auth import require_authors_page_access
from app.models import Author, User
from app.roles import DEPARTMENT_HEAD_ROLE_ID
from app.schemas.report import AuthorsReportRequest
from app.services import reports_service
from app.services.author_service import get_author_by_id

router = APIRouter(prefix="/admin/reports", tags=["admin-reports"])


def _xlsx_response(report: reports_service.ReportFile) -> Response:
    return Response(
        content=report.content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": reports_service.build_content_disposition(
                report.filename
            )
        },
    )


def _ensure_author_report_access(
    db: Session,
    *,
    current_user: User,
    author_ids: list[int],
) -> None:
    if current_user.role_id != DEPARTMENT_HEAD_ROLE_ID:
        return

    rows = (
        db.query(Author.authorID)
        .filter(
            Author.authorID.in_(author_ids),
            Author.DepartmentCode == current_user.department_id,
        )
        .all()
    )
    allowed_ids = {author_id for (author_id,) in rows}

    if allowed_ids != set(author_ids):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )


@router.get("/author/{author_id}/publications")
def download_author_publications_report(
    author_id: int,
    year_from: int | None = Query(None, ge=1900, le=2100),
    year_to: int | None = Query(None, ge=1900, le=2100),
    article_ids: Annotated[list[int] | None, Query()] = None,
    current_user: User = Depends(require_authors_page_access),
    db: Session = Depends(get_db),
):
    author = get_author_by_id(db, author_id)
    _ensure_author_report_access(
        db,
        current_user=current_user,
        author_ids=[author.authorID],
    )
    report = reports_service.generate_author_publications_report(
        db=db,
        author_id=author.authorID,
        author_name=author.authorName,
        year_from=year_from,
        year_to=year_to,
        article_ids=article_ids or None,
    )
    return _xlsx_response(report)


@router.post("/authors/publications")
def download_authors_publications_report(
    payload: AuthorsReportRequest,
    current_user: User = Depends(require_authors_page_access),
    db: Session = Depends(get_db),
):
    _ensure_author_report_access(
        db,
        current_user=current_user,
        author_ids=payload.author_ids,
    )
    report = reports_service.generate_authors_publications_report(
        db=db,
        author_ids=payload.author_ids,
        year_from=payload.year_from,
        year_to=payload.year_to,
        article_ids=payload.article_ids,
    )
    return _xlsx_response(report)


@router.post("/authors/summary")
def download_authors_summary_report(
    payload: AuthorsReportRequest,
    current_user: User = Depends(require_authors_page_access),
    db: Session = Depends(get_db),
):
    _ensure_author_report_access(
        db,
        current_user=current_user,
        author_ids=payload.author_ids,
    )
    report = reports_service.generate_authors_summary_report(
        db=db,
        author_ids=payload.author_ids,
        year_from=payload.year_from,
        year_to=payload.year_to,
    )
    return _xlsx_response(report)


@router.post("/authors/export")
def download_authors_export_report(
    payload: AuthorsReportRequest,
    current_user: User = Depends(require_authors_page_access),
    db: Session = Depends(get_db),
):
    _ensure_author_report_access(
        db,
        current_user=current_user,
        author_ids=payload.author_ids,
    )
    report = reports_service.generate_authors_export_report(
        db=db,
        author_ids=payload.author_ids,
    )
    return _xlsx_response(report)
