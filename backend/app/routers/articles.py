from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from sqlalchemy import text

router = APIRouter(prefix="/articles", tags=["articles"])


@router.get("/latest")
def get_latest_articles(db: Session = Depends(get_db)):
    query = text("""
        SELECT
            Record_ID,
            Title_Analitic_F4 AS title,
            Author_Analitic_F1 AS authors,
            Title_of_Material_F9 AS journal,
            Date_of_Publication_F20 AS year,
            DOI
        FROM articles
        ORDER BY PublicationDate DESC
        LIMIT 5
    """)

    result = db.execute(query).mappings().all()

    return list(result)