from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter(tags=["health"])


@router.get("/")
def root():
    return {"status": "ok"}


@router.get("/health/db")
def health_db(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT 1 as ok")).mappings().first()
    return {"database": result["ok"] == 1}


@router.get("/articles/count")
def articles_count(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT COUNT(*) AS count FROM articles")).mappings().first()
    return {"count": result["count"]}


@router.get("/authors/count")
def authors_count(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT COUNT(*) AS count FROM authors")).mappings().first()
    return {"count": result["count"]}