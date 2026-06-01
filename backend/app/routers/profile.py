from __future__ import annotations

import urllib.parse
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies.auth import get_current_user
from app.models import User
from app.services import profile_service

router = APIRouter(prefix="/profile", tags=["profile"])


def _require_author(current_user: User) -> int:
    """Проверяет, что у пользователя привязан автор, и возвращает author_id."""
    if not current_user.author_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Пользователь не привязан к записи автора.",
        )
    return current_user.author_id


@router.get("/publications")
def get_profile_publications(
    page: int = Query(1, ge=1),
    page_size: int = Query(
        profile_service.DEFAULT_PAGE_SIZE,
        ge=1,
        le=profile_service.MAX_PAGE_SIZE,
    ),
    year_from: int | None = Query(None, ge=1900, le=2100),
    year_to: int | None = Query(None, ge=1900, le=2100),
    text_query: str | None = Query(None),
    publication_types: list[str] | None = Query(None),
    databases: list[str] | None = Query(None),
    original_translation_mode: str = Query("all"),
    sort_by: str = Query("year"),
    sort_order: str = Query("desc"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    author_id = _require_author(current_user)
    return profile_service.get_profile_publications(
        db=db,
        author_id=author_id,
        page=page,
        page_size=page_size,
        year_from=year_from,
        year_to=year_to,
        text_query=text_query,
        publication_types=publication_types,
        databases=databases,
        original_translation_mode=original_translation_mode,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/stats")
def get_profile_stats(
    year_from: int | None = Query(None, ge=1900, le=2100),
    year_to: int | None = Query(None, ge=1900, le=2100),
    text_query: str | None = Query(None),
    publication_types: list[str] | None = Query(None),
    databases: list[str] | None = Query(None),
    original_translation_mode: str = Query("all"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    author_id = _require_author(current_user)
    return profile_service.get_profile_stats(
        db=db,
        author_id=author_id,
        year_from=year_from,
        year_to=year_to,
        text_query=text_query,
        publication_types=publication_types,
        databases=databases,
        original_translation_mode=original_translation_mode,
    )


@router.get("/report")
def download_profile_report(
    year_from: int | None = Query(None, ge=1900, le=2100),
    year_to: int | None = Query(None, ge=1900, le=2100),
    article_ids: Annotated[list[int] | None, Query()] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    author_id = _require_author(current_user)
    author_name = (
        current_user.author.authorName
        if current_user.author
        else current_user.full_name
    )
    xlsx_bytes = profile_service.generate_profile_report(
        db=db,
        author_id=author_id,
        author_name=author_name,
        year_from=year_from,
        year_to=year_to,
        article_ids=article_ids or None,
    )

    # Суффикс имени файла
    if article_ids:
        range_suffix = f"_selected_{len(article_ids)}"
    elif year_from and year_to:
        range_suffix = f"_{year_from}-{year_to}"
    elif year_from:
        range_suffix = f"_from{year_from}"
    elif year_to:
        range_suffix = f"_to{year_to}"
    else:
        range_suffix = ""

    # ASCII-фолбек для filename= (кириллица → транслит не нужен, просто убираем не-ASCII)
    safe_name_ascii = (
        author_name.encode("ascii", "ignore").decode("ascii").replace(" ", "_")[:40]
        or "author"
    )
    filename_ascii = f"publications_{safe_name_ascii}{range_suffix}.xlsx"

    # RFC 5987: filename*= с UTF-8 кодированием — поддерживают все современные браузеры
    full_name_utf8 = author_name.replace(" ", "_")[:40]
    filename_utf8 = f"publications_{full_name_utf8}{range_suffix}.xlsx"
    filename_encoded = urllib.parse.quote(filename_utf8, safe="")

    content_disposition = (
        f'attachment; filename="{filename_ascii}"; '
        f"filename*=UTF-8''{filename_encoded}"
    )

    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": content_disposition},
    )
