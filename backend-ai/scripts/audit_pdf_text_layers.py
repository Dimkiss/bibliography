from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import fitz

from index_pdf_texts import (
    DEFAULT_PDF_DIR,
    DEFAULT_OUTPUT_DIR,
    MIN_TEXT_CHARS_PER_PAGE,
    find_pdf_path,
    get_article_id,
    is_primary_pdf_filename,
    page_blocks_to_text,
    sha1_file,
)


@dataclass(frozen=True)
class PdfTextAuditItem:
    article_id: int
    pdf_sha1: str | None
    status: str
    pages_count: int
    text_pages_count: int
    text_chars_count: int
    error_message: str | None
    checked_at: str


def iter_pdf_paths(pdf_dir: Path, article_id: int | None) -> Iterable[Path]:
    if article_id is not None:
        path = find_pdf_path(pdf_dir, article_id)
        if path is not None:
            yield path
        return

    def sort_key(path: Path) -> tuple[int, int | str]:
        return (0, int(path.stem)) if path.stem.isdigit() else (1, path.stem)

    yield from sorted(
        (path for path in pdf_dir.glob("*.pdf") if is_primary_pdf_filename(path)),
        key=sort_key,
    )


def audit_pdf(path: Path) -> PdfTextAuditItem:
    article_id = get_article_id(path)
    if article_id is None:
        raise ValueError(f"PDF filename must be numeric article id: {path.name}")

    checked_at = datetime.now(timezone.utc).isoformat()
    pdf_sha1 = sha1_file(path)

    try:
        with fitz.open(path) as document:
            if document.is_encrypted:
                return PdfTextAuditItem(
                    article_id=article_id,
                    pdf_sha1=pdf_sha1,
                    status="encrypted",
                    pages_count=document.page_count,
                    text_pages_count=0,
                    text_chars_count=0,
                    error_message=None,
                    checked_at=checked_at,
                )

            text_pages_count = 0
            text_chars_count = 0

            for page_index in range(document.page_count):
                text = page_blocks_to_text(document.load_page(page_index))
                if len(text) < MIN_TEXT_CHARS_PER_PAGE:
                    continue

                text_pages_count += 1
                text_chars_count += len(text)

            return PdfTextAuditItem(
                article_id=article_id,
                pdf_sha1=pdf_sha1,
                status="has_text" if text_pages_count > 0 else "no_text",
                pages_count=document.page_count,
                text_pages_count=text_pages_count,
                text_chars_count=text_chars_count,
                error_message=None,
                checked_at=checked_at,
            )
    except Exception as exc:
        return PdfTextAuditItem(
            article_id=article_id,
            pdf_sha1=pdf_sha1,
            status="failed",
            pages_count=0,
            text_pages_count=0,
            text_chars_count=0,
            error_message=str(exc),
            checked_at=checked_at,
        )


def write_jsonl(path: Path, rows: Iterable[PdfTextAuditItem]) -> None:
    with path.open("a", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(asdict(row), ensure_ascii=False) + "\n")


def write_article_id_lists(output_dir: Path, rows: list[PdfTextAuditItem]) -> None:
    by_status = {
        "has_text": [],
        "no_text": [],
        "encrypted": [],
        "failed": [],
    }

    for row in rows:
        by_status.setdefault(row.status, []).append(row.article_id)

    for status, article_ids in by_status.items():
        path = output_dir / f"{status}_article_ids.txt"
        path.write_text(
            "\n".join(str(article_id) for article_id in article_ids),
            encoding="utf-8",
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit PDFs and split article ids by text-layer availability.",
    )
    parser.add_argument("--pdf-dir", type=Path, default=DEFAULT_PDF_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--article-id", type=int)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--overwrite", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pdf_dir: Path = args.pdf_dir
    output_dir: Path = args.output_dir
    audit_path = output_dir / "pdf_text_audit.jsonl"

    if not pdf_dir.is_dir():
        raise SystemExit(f"PDF directory does not exist: {pdf_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)

    if args.overwrite:
        audit_path.unlink(missing_ok=True)

    rows: list[PdfTextAuditItem] = []
    processed = 0

    for pdf_path in iter_pdf_paths(pdf_dir, args.article_id):
        if args.limit is not None and processed >= args.limit:
            break

        try:
            row = audit_pdf(pdf_path)
        except ValueError as exc:
            print(f"{pdf_path.name}: skipped, {exc}")
            continue

        processed += 1
        rows.append(row)
        write_jsonl(audit_path, [row])

        print(
            f"{pdf_path.name}: {row.status}, pages={row.pages_count}, "
            f"text_pages={row.text_pages_count}, chars={row.text_chars_count}"
        )

    write_article_id_lists(output_dir, rows)

    counts = {
        status: sum(1 for row in rows if row.status == status)
        for status in ("has_text", "no_text", "encrypted", "failed")
    }
    print(f"Done. processed={processed}, counts={counts}, output={output_dir}")


if __name__ == "__main__":
    main()
