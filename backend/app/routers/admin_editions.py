from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies.auth import require_admin
from app.models import User
from app.schemas.edition import (
    PeriodicalEditionEditResponse,
    PeriodicalEditionPayload,
)
from app.services import admin_editions

router = APIRouter(prefix="/admin/editions", tags=["admin-editions"])


@router.get(
    "/periodical/{source_id}/edit",
    response_model=PeriodicalEditionEditResponse,
)
def admin_get_periodical_edition_for_edit(
    source_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PeriodicalEditionEditResponse:
    try:
        return admin_editions.get_periodical_edition_for_edit(
            db=db,
            source_id=source_id,
        )
    except admin_editions.AdminEditionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/periodical",
    status_code=status.HTTP_201_CREATED,
    response_model=PeriodicalEditionEditResponse,
)
def admin_create_periodical_edition(
    payload: PeriodicalEditionPayload,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PeriodicalEditionEditResponse:
    try:
        return admin_editions.create_periodical_edition(db=db, payload=payload)
    except admin_editions.AdminEditionValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except admin_editions.AdminEditionConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.put(
    "/periodical/{source_id}",
    response_model=PeriodicalEditionEditResponse,
)
def admin_update_periodical_edition(
    source_id: int,
    payload: PeriodicalEditionPayload,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PeriodicalEditionEditResponse:
    try:
        return admin_editions.update_periodical_edition(
            db=db,
            source_id=source_id,
            payload=payload,
        )
    except admin_editions.AdminEditionValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except admin_editions.AdminEditionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except admin_editions.AdminEditionConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
