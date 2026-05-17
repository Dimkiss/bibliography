from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from sqlalchemy import delete


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"
DEFAULT_INDEX_DIR = PROJECT_ROOT / "db" / "pdf_text_index"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import PdfIndexStatus, PdfTextChunk  # noqa: E402


def parse_datetime(value: str | None) -> datetime:
    if not value:
        return datetime.utcnow()

    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    return parsed.replace(tzinfo=None)


def read_jsonl(path: Path) -> Iterable[dict[str, Any]]:
    with path.open(encoding="utf-8") as file:
        for line in file:
            if not line.strip():
                continue

            yield json.loads(line)


def batched(items: Iterable[dict[str, Any]], batch_size: int) -> Iterable[list[dict[str, Any]]]:
    batch: list[dict[str, Any]] = []

    for item in items:
        batch.append(item)

        if len(batch) >= batch_size:
            yield batch
            batch = []

    if batch:
        yield batch


def normalize_status_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "article_id": int(row["article_id"]),
        "pdf_sha1": row.get("pdf_sha1"),
        "status": str(row["status"]),
        "pages_count": int(row.get("pages_count") or 0),
        "chunks_count": int(row.get("chunks_count") or 0),
        "error_message": row.get("error_message"),
        "indexed_at": parse_datetime(row.get("indexed_at")),
    }


def normalize_chunk_row(row: dict[str, Any]) -> dict[str, Any]:
    text = str(row.get("text") or "")
    return {
        "article_id": int(row["article_id"]),
        "pdf_sha1": str(row["pdf_sha1"]),
        "page_number": int(row["page_number"]),
        "chunk_index": int(row["chunk_index"]),
        "text": text,
        "text_length": int(row.get("text_length") or len(text)),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import prepared PDF text index JSONL files into MySQL.",
    )
    parser.add_argument("--index-dir", type=Path, default=DEFAULT_INDEX_DIR)
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Delete existing pdf_text_chunks and pdf_index_status rows before import.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    index_dir: Path = args.index_dir
    status_path = index_dir / "status.jsonl"
    chunks_path = index_dir / "chunks.jsonl"

    if not status_path.is_file():
        raise SystemExit(f"status.jsonl does not exist: {status_path}")

    if not chunks_path.is_file():
        raise SystemExit(f"chunks.jsonl does not exist: {chunks_path}")

    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        if args.overwrite:
            db.execute(delete(PdfTextChunk))
            db.execute(delete(PdfIndexStatus))
            db.commit()

        status_count = 0
        for batch in batched(
            (normalize_status_row(row) for row in read_jsonl(status_path)),
            args.batch_size,
        ):
            db.bulk_insert_mappings(PdfIndexStatus, batch)
            db.commit()
            status_count += len(batch)
            print(f"Imported status rows: {status_count}")

        chunk_count = 0
        for batch in batched(
            (normalize_chunk_row(row) for row in read_jsonl(chunks_path)),
            args.batch_size,
        ):
            db.bulk_insert_mappings(PdfTextChunk, batch)
            db.commit()
            chunk_count += len(batch)
            print(f"Imported chunk rows: {chunk_count}")

    print(
        f"Done. status_rows={status_count}, chunk_rows={chunk_count}, "
        f"source={index_dir}"
    )


if __name__ == "__main__":
    main()
