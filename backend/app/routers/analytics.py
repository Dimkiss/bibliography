from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.analytics_service import get_dashboard_analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
def analytics_dashboard(
    years_from: int = Query(2020, ge=1900, le=2100),
    years_to: int = Query(2024, ge=1900, le=2100),
    types_year: int = Query(2024, ge=1900, le=2100),
    lwl_year: int = Query(2024, ge=1900, le=2100),
    db: Session = Depends(get_db),
):
    return get_dashboard_analytics(
        db=db,
        years_from=years_from,
        years_to=years_to,
        types_year=types_year,
        lwl_year=lwl_year,
    )