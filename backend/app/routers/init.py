from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.init_service import init_reference_data

router = APIRouter(tags=["init"])


@router.post("/init-data")
def init_data(db: Session = Depends(get_db)):
    return init_reference_data(db)