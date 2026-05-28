from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import fitz


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PDF_DIR = PROJECT_ROOT / "db" / "pdf"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "db" / "pdf_text_index"

MIN_TEXT_CHARS_PER_PAGE = 40
DEFAULT_CHUNK_SIZE = 1600
DEFAULT_OVERLAP_CHARS = 220
MIN_CHUNK_CHARS = 120
MIN_INDEXABLE_CHUNK_QUALITY = 0.22

SECTION_MARKERS = (
    "abstract",
    "аннотация",
    "introduction",
    "введение",
    "materials and methods",
    "материалы и методы",
)

BODY_START_HEADING_RE = re.compile(
    r"(?im)^\s*(?:\d+(?:\.\d+)*\.?\s*)?(?:"
    r"introduction|введение|"
    r"materials?\s+and\s+methods?|материалы\s+и\s+методы|"
    r"results?|результаты|"
    r"discussion|обсуждение"
    r")\s*$"
)

REFERENCE_HEADING_RE = re.compile(
    r"(?im)^\s*(?:\d+(?:\.\d+)*\.?\s*)?(?:"
    r"references|bibliography|literature\s+cited|works\s+cited|"
    r"литература|список\s+литературы|библиографический\s+список|"
    r"список\s+использованн(?:ых|ой)\s+(?:источников|литературы)"
    r")\s*$"
)

INLINE_REFERENCE_HEADING_RE = re.compile(
    r"(?i)\b(?:список\s+литературы|литература|references|bibliography)\b"
)

ABSTRACT_HEADING_RE = re.compile(
    r"(?im)^\s*(?:abstract|аннотация|резюме)\s*\.?\s*"
)

KEYWORDS_LINE_RE = re.compile(
    r"(?im)^\s*(?:key\s*words?|keywords?|ключевые\s+слова)\s*:?.*$"
)

TOC_HEADING_RE = re.compile(
    r"(?im)^\s*(?:contents?|table\s+of\s+contents|оглавление|содержание)\s*$"
)

REFERENCE_LIST_MARKER_RE = re.compile(
    r"(?im)(?:^\s*\d{1,3}\.\s+.+\b(?:19|20)\d{2}\b|"
    r"\b(?:crossref|pubmed|doi|et\s+al\.|journal|vol\.|т\.\s*\d+|№|изд-во|издательство)\b|"
    r"//|(?:^|\s)(?:с|стр|pp?)\.\s*\d+)"
)

BOILERPLATE_PARAGRAPH_RE = re.compile(
    r"(?i)\b(?:"
    r"publisher'?s\s+note|copyright|licensee|creative\s+commons|"
    r"distributed\s+under\s+the\s+terms|www\.mdpi\.com|"
    r"all\s+rights\s+reserved|see\s+front\s+matter|\bpii\s*:|"
    r"received:\s+\d|revised:\s+\d|accepted:\s+\d|published:\s+\d"
    r")\b"
)

INLINE_BOILERPLATE_RE = re.compile(
    r"(?is)\bpublisher'?s\s+note:\s*mdpi\s+stays\s+neutral\s+with\s+regard\s+to\s+"
    r"jurisdictional\s+claims\s+in\s+published\s+maps\s+and\s+institutional\s+affiliations\.?"
)

MOJIBAKE_CHARS_RE = re.compile(r"[À-ÿ]")
CYRILLIC_CHARS_RE = re.compile(r"[А-Яа-яЁё]")
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]+")
PDF_SOFT_BREAK_RE = re.compile(
    r"(?<=[A-Za-zА-Яа-яЁё])[\u0010\u0019]\s*(?=[A-Za-zА-Яа-яЁё])"
)
LETTER_CHARS = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя")
AFFILIATION_RE = re.compile(
    r"\b(?:institute|university|academy|институт\w*|университет\w*|академи\w*|"
    r"со\s+ран|sb\s+ras|ras\s+sb)\b",
    flags=re.IGNORECASE,
)


@dataclass(frozen=True)
class PdfChunk:
    article_id: int
    pdf_sha1: str
    page_number: int
    chunk_index: int
    text: str
    text_length: int


@dataclass(frozen=True)
class PdfIndexStatus:
    article_id: int
    pdf_sha1: str | None
    status: str
    pages_count: int
    chunks_count: int
    error_message: str | None
    indexed_at: str


def normalize_text(value: str) -> str:
    text = value.replace("\u00ad", "")
    text = PDF_SOFT_BREAK_RE.sub("", text)
    text = CONTROL_CHARS_RE.sub(" ", text)
    text = re.sub(r"(?<=\w)-\s*\n\s*(?=\w)", "", text)
    paragraphs = [
        re.sub(r"\s+", " ", paragraph).strip()
        for paragraph in re.split(r"\n\s*\n", text)
        if paragraph.strip()
    ]
    text = "\n\n".join(paragraphs)
    return text.strip()


def get_text_quality_score(text: str) -> float:
    if len(text) < MIN_CHUNK_CHARS:
        return 0

    non_space_chars = [char for char in text if not char.isspace()]
    if not non_space_chars:
        return 0

    letter_count = sum(1 for char in non_space_chars if char.isalpha())
    digit_count = sum(1 for char in non_space_chars if char.isdigit())
    punctuation_count = sum(
        1
        for char in non_space_chars
        if not char.isalnum()
    )

    letter_ratio = letter_count / len(non_space_chars)
    digit_ratio = digit_count / len(non_space_chars)
    punctuation_ratio = punctuation_count / len(non_space_chars)

    if letter_count < 35 or letter_ratio < 0.18:
        return 0

    score = letter_ratio - max(digit_ratio - 0.35, 0) * 0.55
    score -= max(punctuation_ratio - 0.42, 0) * 0.35
    return max(0, min(score, 1))


def looks_like_low_quality_chunk(text: str) -> bool:
    if get_text_quality_score(text) < MIN_INDEXABLE_CHUNK_QUALITY:
        return True

    words = re.findall(r"[A-Za-zА-Яа-яЁё]{3,}", text)
    if len(words) < 8:
        return True

    numeric_tokens = len(re.findall(r"(?:^|\s)[+-]?\d+(?:[.,]\d+)?(?:\s|$)", text))
    return (
        (numeric_tokens >= 30 and numeric_tokens > len(words) * 1.6)
        or looks_like_table_or_figure_residue(text)
    )


def looks_like_table_fragment(text: str) -> bool:
    normalized = text.strip()
    if not normalized:
        return True

    words = re.findall(r"[A-Za-zА-Яа-яЁё]{3,}", normalized)
    numeric_tokens = re.findall(r"[+-]?\d+(?:[.,]\d+)?", normalized)
    non_space_chars = [char for char in normalized if not char.isspace()]

    if not non_space_chars:
        return True

    letter_count = sum(1 for char in non_space_chars if char.isalpha())
    letter_ratio = letter_count / len(non_space_chars)

    if len(numeric_tokens) >= 4 and len(numeric_tokens) > len(words) * 1.4:
        return True

    if len(normalized) < MIN_CHUNK_CHARS and len(words) < 6 and letter_ratio < 0.35:
        return True

    return False


def looks_like_table_or_figure_residue(text: str) -> bool:
    normalized = re.sub(r"\s+", " ", text).strip()
    if len(normalized) >= 900:
        return False

    lower_text = normalized.lower()
    has_table_or_figure_marker = any(
        marker in lower_text
        for marker in (
            "таблица",
            "рис.",
            "рисунок",
            "figure",
            "fig.",
            "в числителе",
            "в знаменателе",
            "численность/биомасса",
        )
    )
    if not has_table_or_figure_marker:
        return False

    strong_table_marker = any(
        marker in lower_text
        for marker in (
            "в числителе",
            "в знаменателе",
            "численность/биомасса",
        )
    )
    if strong_table_marker and len(normalized) < 700:
        return True

    sentence_endings = len(re.findall(r"[.!?](?:\s|$)", normalized))
    words = re.findall(r"[A-Za-zА-Яа-яЁё]{3,}", normalized)
    numeric_tokens = re.findall(r"[+-]?\d+(?:[.,]\d+)?", normalized)

    if sentence_endings <= 1 and len(words) < 70:
        return True

    return len(numeric_tokens) >= 8 and len(numeric_tokens) > len(words) * 0.35


def remove_low_quality_paragraphs(text: str) -> str:
    paragraphs = [
        paragraph
        for paragraph in split_paragraphs(text)
        if not looks_like_table_fragment(paragraph)
    ]

    return "\n\n".join(paragraphs).strip()


def looks_like_decorative_text(text: str) -> bool:
    letters_count = sum(1 for char in text if char in LETTER_CHARS)
    if letters_count < 20:
        return True

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return True

    single_letter_lines = sum(
        1
        for line in lines
        if sum(1 for char in line if char in LETTER_CHARS) == 1
    )

    return len(lines) >= 8 and single_letter_lines / len(lines) > 0.55


def looks_like_mojibake(text: str) -> bool:
    if not text:
        return False

    suspicious_chars = len(MOJIBAKE_CHARS_RE.findall(text))
    cyrillic_chars = len(CYRILLIC_CHARS_RE.findall(text))

    return suspicious_chars >= 12 and suspicious_chars > cyrillic_chars * 2


def find_heading_match(pattern: re.Pattern[str], text: str) -> re.Match[str] | None:
    return pattern.search(text)


def strip_before_body_start(text: str) -> str:
    match = find_heading_match(BODY_START_HEADING_RE, text)
    if match is None:
        return text

    return text[match.start() :].strip()


def strip_title_before_abstract(text: str) -> str:
    match = find_heading_match(ABSTRACT_HEADING_RE, text)
    if match is None:
        return text

    return text[match.end() :].strip()


def looks_like_metadata_paragraph(text: str) -> bool:
    paragraph = text.strip()
    if not paragraph:
        return True

    letters = [char for char in paragraph if char in LETTER_CHARS]
    if not letters:
        return True

    upper_letters = sum(1 for char in letters if char.upper() == char and char.lower() != char)
    upper_ratio = upper_letters / len(letters)

    return (
        (len(paragraph) <= 260 and upper_ratio >= 0.65)
        or "@" in paragraph
        or (
            len(paragraph) <= 600
            and AFFILIATION_RE.search(paragraph) is not None
        )
    )


def looks_like_author_line(text: str) -> bool:
    paragraph = text.strip()
    if len(paragraph) > 220:
        return False

    initials_count = len(re.findall(r"[А-ЯA-ZЁ]\.\s*[А-ЯA-ZЁ]\.", paragraph))
    return initials_count >= 2 or (initials_count >= 1 and paragraph.count(",") >= 2)


def strip_abstract_sections(text: str) -> str:
    first_abstract = ABSTRACT_HEADING_RE.search(text)
    if first_abstract is not None:
        text = text[first_abstract.start() :]

    paragraphs = split_paragraphs(text)
    result: list[str] = []
    skip_metadata_after_abstract = False

    for paragraph in paragraphs:
        if ABSTRACT_HEADING_RE.match(paragraph):
            skip_metadata_after_abstract = True
            continue

        if skip_metadata_after_abstract and looks_like_metadata_paragraph(paragraph):
            continue

        if skip_metadata_after_abstract and len(paragraph) <= 420:
            continue

        skip_metadata_after_abstract = False
        result.append(paragraph)

    return "\n\n".join(result).strip()


def strip_references_tail(text: str) -> tuple[str, bool]:
    match = find_heading_match(REFERENCE_HEADING_RE, text)
    if match is not None:
        return text[: match.start()].strip(), True

    inline_match = INLINE_REFERENCE_HEADING_RE.search(text)
    if inline_match is None:
        return text, False

    before = text[: inline_match.start()].strip()
    after = text[inline_match.start() :].strip()

    reference_entries = count_numbered_reference_lines(after)
    reference_markers = len(REFERENCE_LIST_MARKER_RE.findall(after))
    looks_like_reference_tail = (
        reference_entries >= 1
        or reference_markers >= 2
        or looks_like_bibliography_text(after)
    )

    if len(before) >= MIN_CHUNK_CHARS and looks_like_reference_tail:
        return before, True

    if len(before) < MIN_CHUNK_CHARS and looks_like_reference_tail:
        return "", True

    return text, False


def remove_boilerplate_paragraphs(text: str) -> str:
    text = INLINE_BOILERPLATE_RE.sub(" ", text)
    paragraphs = [
        paragraph
        for paragraph in split_paragraphs(text)
        if not BOILERPLATE_PARAGRAPH_RE.search(paragraph)
    ]

    return "\n\n".join(paragraphs).strip()


def clean_unstructured_page_text(text: str) -> str:
    if looks_like_toc_page(text):
        return ""

    text, references_started = strip_references_tail(text)
    if references_started and not text:
        return ""

    text = KEYWORDS_LINE_RE.sub(" ", text)
    text = remove_boilerplate_paragraphs(text)

    paragraphs: list[str] = []
    content_started = False

    for paragraph in split_paragraphs(text):
        if looks_like_bibliography_text(paragraph):
            continue

        if not content_started:
            if looks_like_metadata_paragraph(paragraph):
                continue

            if looks_like_author_line(paragraph):
                continue

            letters_count = sum(1 for char in paragraph if char in LETTER_CHARS)
            lower_count = sum(1 for char in paragraph if char.lower() == char and char.upper() != char)
            if letters_count < 25 or lower_count / max(letters_count, 1) < 0.45:
                continue

            content_started = True

        paragraphs.append(paragraph)

    return normalize_text("\n\n".join(paragraphs))


def looks_like_toc_page(text: str) -> bool:
    if not text:
        return False

    normalized = text.lower()
    dot_leaders = len(re.findall(r"\.{8,}\s*\d{1,4}", text))
    if dot_leaders >= 3:
        return True

    if not TOC_HEADING_RE.search(text) and not any(
        marker in normalized
        for marker in ("chapter", "глава", "part ", "часть ")
    ):
        return False

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) < 5:
        return False

    numbered_lines = sum(
        1
        for line in lines
        if re.search(r"(?:\.{3,}|\s{2,})\s*\d{1,4}\s*$", line)
    )

    return numbered_lines >= 3 or numbered_lines / len(lines) >= 0.25


def looks_like_bibliography_text(text: str) -> bool:
    if len(text) < MIN_CHUNK_CHARS:
        return False

    numbered_reference_lines = count_numbered_reference_lines(text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    bibliographic_markers = sum(
        1
        for line in lines
        if re.search(r"\b(?:crossref|pubmed|doi|et\s+al\.|journal|vol\.)\b", line, flags=re.IGNORECASE)
    )

    return (
        numbered_reference_lines >= 4
        or (numbered_reference_lines >= 2 and len(text) < 1200)
        or bibliographic_markers >= 8
    )


def count_numbered_reference_lines(text: str) -> int:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    line_entries = sum(
        1
        for line in lines
        if re.match(r"^\d{1,3}\.\s+.+(?:19|20)\d{2}", line)
    )

    inline_entries = len(
        re.findall(
            r"(?:^|\s)\d{1,3}\.\s+.{20,}?(?:(?:19|20)\d{2}|//)",
            text,
        )
    )

    return max(line_entries, inline_entries)


def clean_page_text_for_indexing(
    text: str,
    page_number: int,
    references_started: bool,
    content_started: bool,
) -> tuple[str, bool, bool]:
    if references_started:
        return "", True, content_started

    if looks_like_toc_page(text):
        return "", references_started, content_started

    text, references_started = strip_references_tail(text)
    if not text:
        return "", references_started, content_started

    has_body_start = BODY_START_HEADING_RE.search(text) is not None
    has_abstract = ABSTRACT_HEADING_RE.search(text) is not None

    if not content_started and not has_body_start and not has_abstract:
        # Some conference papers and legacy PDFs have no stable section headings.
        # Keep page 1 conservative because it often duplicates title/abstract data
        # already stored in DB, but allow later long pages to start the PDF index.
        if page_number <= 1 or len(text) < DEFAULT_CHUNK_SIZE // 2:
            return "", references_started, content_started

    content_started = True

    # On the opening pages of articles, metadata and abstracts duplicate DB fields.
    if has_body_start:
        body_text = strip_before_body_start(text)
        text = body_text
    elif has_abstract:
        text = strip_abstract_sections(text)

    text = KEYWORDS_LINE_RE.sub(" ", text)
    text = remove_boilerplate_paragraphs(text)
    text = normalize_text(text)

    return text, references_started, content_started


def try_fix_mojibake(text: str) -> str:
    if not looks_like_mojibake(text):
        return text

    try:
        fixed = text.encode("latin1", errors="ignore").decode(
            "cp1251",
            errors="ignore",
        )
    except UnicodeError:
        return text

    fixed_cyrillic_chars = len(CYRILLIC_CHARS_RE.findall(fixed))
    original_cyrillic_chars = len(CYRILLIC_CHARS_RE.findall(text))

    return fixed if fixed_cyrillic_chars > original_cyrillic_chars else text


def block_to_text(block: tuple) -> str:
    return normalize_text(str(block[4]))


def page_blocks_to_text(page: fitz.Page) -> str:
    blocks = [
        block
        for block in page.get_text("blocks", sort=True)
        if len(block) >= 7 and block[6] == 0 and block_to_text(block)
    ]

    if not blocks:
        return ""

    page_width = float(page.rect.width)
    left_blocks = [block for block in blocks if ((float(block[0]) + float(block[2])) / 2) < page_width / 2]
    right_blocks = [block for block in blocks if ((float(block[0]) + float(block[2])) / 2) >= page_width / 2]
    has_two_columns = (
        len(left_blocks) >= 2
        and len(right_blocks) >= 2
        and min(float(block[0]) for block in right_blocks)
        - max(float(block[2]) for block in left_blocks)
        > page_width * 0.04
    )

    if has_two_columns:
        ordered_blocks = sorted(left_blocks, key=lambda block: (float(block[1]), float(block[0])))
        ordered_blocks.extend(
            sorted(right_blocks, key=lambda block: (float(block[1]), float(block[0])))
        )
    else:
        ordered_blocks = sorted(blocks, key=lambda block: (float(block[1]), float(block[0])))

    text = "\n\n".join(block_to_text(block) for block in ordered_blocks)
    text = try_fix_mojibake(normalize_text(text))

    if looks_like_decorative_text(text):
        return ""

    return text


def split_paragraphs(text: str) -> list[str]:
    return [
        paragraph.strip()
        for paragraph in re.split(r"\n\s*\n", text)
        if paragraph.strip()
    ]


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?。！？])\s+", text)
    return [part.strip() for part in parts if part.strip()]


def split_long_text_by_words(text: str, max_chars: int) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    current_words: list[str] = []
    current_length = 0

    for word in words:
        next_length = current_length + len(word) + (1 if current_words else 0)

        if current_words and next_length > max_chars:
            chunks.append(" ".join(current_words))
            current_words = [word]
            current_length = len(word)
            continue

        current_words.append(word)
        current_length = next_length

    if current_words:
        chunks.append(" ".join(current_words))

    return chunks


def add_overlap(chunks: list[str], overlap_chars: int) -> list[str]:
    if overlap_chars <= 0 or len(chunks) <= 1:
        return chunks

    result = [chunks[0]]

    for previous, current in zip(chunks, chunks[1:]):
        overlap = previous[-overlap_chars:].strip()
        if overlap:
            current = f"{overlap} {current}".strip()

        result.append(current)

    return result


def chunk_page_text(
    text: str,
    max_chars: int,
    overlap_chars: int,
) -> list[str]:
    text = remove_low_quality_paragraphs(text)
    paragraphs = split_paragraphs(text)
    chunks: list[str] = []
    current_parts: list[str] = []
    current_length = 0

    def flush_current() -> None:
        nonlocal current_parts, current_length
        if current_parts:
            chunks.append("\n\n".join(current_parts).strip())
            current_parts = []
            current_length = 0

    for paragraph in paragraphs:
        if len(paragraph) > max_chars:
            flush_current()
            sentence_chunks: list[str] = []

            for sentence in split_sentences(paragraph):
                if len(sentence) > max_chars:
                    sentence_chunks.extend(split_long_text_by_words(sentence, max_chars))
                else:
                    sentence_chunks.append(sentence)

            for sentence_chunk in sentence_chunks:
                if chunks and len(chunks[-1]) + len(sentence_chunk) + 2 <= max_chars:
                    chunks[-1] = f"{chunks[-1]} {sentence_chunk}".strip()
                else:
                    chunks.append(sentence_chunk)

            continue

        next_length = current_length + len(paragraph) + (2 if current_parts else 0)

        if current_parts and next_length > max_chars:
            flush_current()

        current_parts.append(paragraph)
        current_length = current_length + len(paragraph) + (2 if current_length else 0)

    flush_current()
    filtered_chunks = [
        chunk
        for chunk in chunks
        if len(chunk) >= MIN_CHUNK_CHARS
        and not looks_like_low_quality_chunk(chunk)
        and not looks_like_decorative_text(chunk)
        and not looks_like_bibliography_text(chunk)
    ]
    return add_overlap(filtered_chunks, overlap_chars)


def find_section_markers(text: str) -> list[str]:
    normalized = text.lower()
    return [marker for marker in SECTION_MARKERS if marker in normalized]


def find_pdf_path(pdf_dir: Path, article_id: int) -> Path | None:
    for suffix in (".pdf", ".PDF"):
        path = pdf_dir / f"{article_id}{suffix}"
        if path.is_file():
            return path

    return None


def load_article_ids(path: Path) -> list[int]:
    article_ids: list[int] = []

    with path.open(encoding="utf-8") as file:
        for line in file:
            value = line.strip()
            if value.isdigit():
                article_ids.append(int(value))

    return list(dict.fromkeys(article_ids))


def iter_pdf_paths(
    pdf_dir: Path,
    article_id: int | None,
    article_ids: list[int] | None,
    limit: int | None,
) -> Iterable[Path]:
    if article_id is not None:
        path = find_pdf_path(pdf_dir, article_id)
        if path is not None:
            yield path
        return

    if article_ids:
        count = 0
        for current_article_id in article_ids:
            path = find_pdf_path(pdf_dir, current_article_id)
            if path is None:
                continue

            yield path
            count += 1

            if limit is not None and count >= limit:
                return

        return

    count = 0
    def sort_key(path: Path) -> tuple[int, int | str]:
        return (0, int(path.stem)) if path.stem.isdigit() else (1, path.stem)

    for path in sorted(pdf_dir.glob("*.pdf"), key=sort_key):
        yield path
        count += 1

        if limit is not None and count >= limit:
            return


def get_article_id(path: Path) -> int | None:
    return int(path.stem) if path.stem.isdigit() else None


def is_primary_pdf_filename(path: Path) -> bool:
    return path.stem.isdigit()


def sha1_file(path: Path) -> str:
    digest = hashlib.sha1()

    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)

    return digest.hexdigest()


def write_jsonl(path: Path, rows: Iterable[object]) -> None:
    with path.open("a", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(asdict(row), ensure_ascii=False) + "\n")


def load_processed_article_ids(status_path: Path) -> set[int]:
    if not status_path.is_file():
        return set()

    article_ids: set[int] = set()

    with status_path.open(encoding="utf-8") as file:
        for line in file:
            if not line.strip():
                continue

            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            article_id = data.get("article_id")
            if isinstance(article_id, int) and article_id > 0:
                article_ids.add(article_id)

    return article_ids


def index_pdf(
    path: Path,
    chunk_size: int,
    overlap_chars: int,
) -> tuple[list[PdfChunk], PdfIndexStatus]:
    article_id = get_article_id(path)
    if article_id is None:
        raise ValueError(f"PDF filename must be numeric article id: {path.name}")

    indexed_at = datetime.now(timezone.utc).isoformat()
    pdf_sha1 = sha1_file(path)
    chunks: list[PdfChunk] = []
    text_pages_count = 0
    fallback_pages: list[tuple[int, str]] = []

    try:
        with fitz.open(path) as document:
            if document.is_encrypted:
                return chunks, PdfIndexStatus(
                    article_id=article_id,
                    pdf_sha1=pdf_sha1,
                    status="encrypted",
                    pages_count=document.page_count,
                    chunks_count=0,
                    error_message=None,
                    indexed_at=indexed_at,
                )

            references_started = False
            content_started = False
            persist_references_tail = document.page_count < 50

            for page_index in range(document.page_count):
                page_text = page_blocks_to_text(document.load_page(page_index))
                if len(page_text) >= MIN_TEXT_CHARS_PER_PAGE:
                    text_pages_count += 1
                    fallback_pages.append((page_index + 1, page_text))

                page_references_started = references_started if persist_references_tail else False
                page_text, page_references_started, content_started = clean_page_text_for_indexing(
                    page_text,
                    page_number=page_index + 1,
                    references_started=page_references_started,
                    content_started=content_started,
                )
                references_started = page_references_started if persist_references_tail else False

                if len(page_text) < MIN_TEXT_CHARS_PER_PAGE:
                    continue

                page_chunks = chunk_page_text(
                    page_text,
                    max_chars=chunk_size,
                    overlap_chars=overlap_chars,
                )

                for chunk_index, chunk_text in enumerate(page_chunks):
                    chunks.append(
                        PdfChunk(
                            article_id=article_id,
                            pdf_sha1=pdf_sha1,
                            page_number=page_index + 1,
                            chunk_index=chunk_index,
                            text=chunk_text,
                            text_length=len(chunk_text),
                        )
                    )

            if not chunks and text_pages_count:
                for page_number, fallback_text in fallback_pages:
                    fallback_text = clean_unstructured_page_text(fallback_text)
                    if len(fallback_text) < MIN_TEXT_CHARS_PER_PAGE:
                        continue

                    page_chunks = chunk_page_text(
                        fallback_text,
                        max_chars=chunk_size,
                        overlap_chars=overlap_chars,
                    )

                    for chunk_index, chunk_text in enumerate(page_chunks):
                        chunks.append(
                            PdfChunk(
                                article_id=article_id,
                                pdf_sha1=pdf_sha1,
                                page_number=page_number,
                                chunk_index=chunk_index,
                                text=chunk_text,
                                text_length=len(chunk_text),
                            )
                        )

            status = "indexed" if chunks else ("filtered_out" if text_pages_count else "no_text")
            return chunks, PdfIndexStatus(
                article_id=article_id,
                pdf_sha1=pdf_sha1,
                status=status,
                pages_count=document.page_count,
                chunks_count=len(chunks),
                error_message=None,
                indexed_at=indexed_at,
            )
    except Exception as exc:
        return chunks, PdfIndexStatus(
            article_id=article_id,
            pdf_sha1=pdf_sha1,
            status="failed",
            pages_count=0,
            chunks_count=0,
            error_message=str(exc),
            indexed_at=indexed_at,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract text from article PDFs and write page-aware chunks to JSONL.",
    )
    parser.add_argument("--pdf-dir", type=Path, default=DEFAULT_PDF_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--article-id", type=int)
    parser.add_argument(
        "--article-ids-file",
        type=Path,
        help="Text file with one article_id per line. Useful after PDF text audit.",
    )
    parser.add_argument("--limit", type=int)
    parser.add_argument(
        "--limit-indexed",
        type=int,
        help="Keep scanning PDFs until this many files with extracted text are indexed.",
    )
    parser.add_argument("--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE)
    parser.add_argument("--overlap", type=int, default=DEFAULT_OVERLAP_CHARS)
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Remove previous chunks.jsonl and status.jsonl before indexing.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip article ids already present in status.jsonl and continue indexing.",
    )
    parser.add_argument(
        "--inspect",
        action="store_true",
        help="Print extracted text diagnostics for --article-id without writing JSONL.",
    )
    parser.add_argument("--inspect-pages", type=int, default=5)
    return parser.parse_args()


def inspect_pdf(path: Path, max_pages: int) -> None:
    with fitz.open(path) as document:
        print(f"{path.name}: pages={document.page_count}, encrypted={document.is_encrypted}")
        references_started = False
        content_started = False

        for page_index in range(min(document.page_count, max_pages)):
            raw_text = page_blocks_to_text(document.load_page(page_index))
            text, references_started, content_started = clean_page_text_for_indexing(
                raw_text,
                page_number=page_index + 1,
                references_started=references_started,
                content_started=content_started,
            )
            markers = find_section_markers(text)
            print(
                f"\n--- page {page_index + 1} --- "
                f"raw_chars={len(raw_text)}, clean_chars={len(text)}, "
                f"mojibake={looks_like_mojibake(raw_text)}, "
                f"toc={looks_like_toc_page(raw_text)}, "
                f"references_started={references_started}, "
                f"content_started={content_started}, "
                f"markers={markers or '-'}"
            )
            print(text[:1200])

            page_chunks = chunk_page_text(
                text,
                max_chars=DEFAULT_CHUNK_SIZE,
                overlap_chars=DEFAULT_OVERLAP_CHARS,
            )
            print(f"indexable_chunks={len(page_chunks)}")
            for chunk_index, chunk_text in enumerate(page_chunks[:3]):
                preview = re.sub(r"\s+", " ", chunk_text).strip()
                quality = get_text_quality_score(chunk_text)
                print(
                    f"  chunk {chunk_index}: chars={len(chunk_text)}, "
                    f"quality={quality:.2f}, preview={preview[:260]}"
                )


def main() -> None:
    args = parse_args()
    pdf_dir: Path = args.pdf_dir
    output_dir: Path = args.output_dir
    chunks_path = output_dir / "chunks.jsonl"
    status_path = output_dir / "status.jsonl"

    if not pdf_dir.is_dir():
        raise SystemExit(f"PDF directory does not exist: {pdf_dir}")

    if args.inspect:
        if args.article_id is None:
            raise SystemExit("--inspect requires --article-id")

        inspect_path = pdf_dir / f"{args.article_id}.pdf"
        if not inspect_path.is_file():
            raise SystemExit(f"PDF does not exist: {inspect_path}")

        inspect_pdf(inspect_path, max_pages=args.inspect_pages)
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    if args.overwrite and args.resume:
        raise SystemExit("--overwrite and --resume cannot be used together")

    if args.overwrite:
        chunks_path.unlink(missing_ok=True)
        status_path.unlink(missing_ok=True)

    processed = 0
    skipped = 0
    indexed = 0
    total_chunks = 0
    scan_limit = None if args.limit_indexed is not None else args.limit
    article_ids = load_article_ids(args.article_ids_file) if args.article_ids_file else None
    processed_article_ids = load_processed_article_ids(status_path) if args.resume else set()

    if processed_article_ids:
        print(f"Resume mode: skipping {len(processed_article_ids)} already processed PDF files.")

    for pdf_path in iter_pdf_paths(pdf_dir, args.article_id, article_ids, scan_limit):
        current_article_id = get_article_id(pdf_path)
        if current_article_id in processed_article_ids:
            skipped += 1
            continue

        processed += 1
        chunks, status = index_pdf(
            pdf_path,
            chunk_size=args.chunk_size,
            overlap_chars=args.overlap,
        )
        write_jsonl(chunks_path, chunks)
        write_jsonl(status_path, [status])

        if status.status == "indexed":
            indexed += 1
            total_chunks += len(chunks)

        print(
            f"{pdf_path.name}: {status.status}, "
            f"pages={status.pages_count}, chunks={status.chunks_count}"
        )

        if args.limit_indexed is not None and indexed >= args.limit_indexed:
            break

    print(
        f"Done. processed={processed}, skipped={skipped}, indexed={indexed}, "
        f"chunks={total_chunks}, output={output_dir}"
    )


if __name__ == "__main__":
    main()
