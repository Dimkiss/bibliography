from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies.auth import require_admin
from app.models import User
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


@router.get("/author/{author_id}/publications")
def download_author_publications_report(
    author_id: int,
    year_from: int | None = Query(None, ge=1900, le=2100),
    year_to: int | None = Query(None, ge=1900, le=2100),
    article_ids: Annotated[list[int] | None, Query()] = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    author = get_author_by_id(db, author_id)
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
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
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
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
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
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    report = reports_service.generate_authors_export_report(
        db=db,
        author_ids=payload.author_ids,
    )
    return _xlsx_response(report)
