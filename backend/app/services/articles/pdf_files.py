from __future__ import annotations

import os
from pathlib import Path
from shutil import copyfileobj

from fastapi import UploadFile


PDF_STORAGE_DIR = Path(
    os.getenv(
        "PDF_STORAGE_DIR",
        Path(__file__).resolve().parents[4] / "db" / "pdf",
    )
)


def get_pdf_path(article_id: int) -> Path:
    return PDF_STORAGE_DIR / f"{article_id}.pdf"


def article_pdf_exists(article_id: int) -> bool:
    return get_pdf_path(article_id).is_file()


def save_article_pdf(article_id: int, upload: UploadFile) -> Path:
    PDF_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    target_path = get_pdf_path(article_id)
    temp_path = target_path.with_suffix(".pdf.tmp")

    upload.file.seek(0)
    with temp_path.open("wb") as output_file:
        copyfileobj(upload.file, output_file)

    temp_path.replace(target_path)
    return target_path


def delete_article_pdf(article_id: int) -> None:
    get_pdf_path(article_id).unlink(missing_ok=True)
