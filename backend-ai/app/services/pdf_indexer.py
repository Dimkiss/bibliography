from __future__ import annotations

import os
import sys
import uuid
from functools import lru_cache
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    MatchValue,
    PointStruct,
    VectorParams,
)

# Импортируем логику извлечения чанков из скрипта индексации.
# В Docker-контейнере скрипты лежат в /app/scripts, сервис — в /app/app/services.
_SCRIPTS_DIR = Path(__file__).resolve().parents[3] / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from index_pdf_texts import (  # noqa: E402
    DEFAULT_CHUNK_SIZE,
    DEFAULT_OVERLAP_CHARS,
    index_pdf as _index_pdf_file,
)

# Тот же namespace что в index_qdrant_pdf_chunks.py — point_id совместимы.
_POINT_NAMESPACE = uuid.UUID("a995a8e0-5d6b-467b-b6e3-d70776d4f42d")
_EMBED_BATCH_SIZE = 64


def _point_id(article_id: int, pdf_sha1: str, page_number: int, chunk_index: int) -> str:
    value = f"{article_id}:{pdf_sha1}:{page_number}:{chunk_index}"
    return str(uuid.uuid5(_POINT_NAMESPACE, value))


def _get_pdf_storage_dir() -> Path:
    return Path(os.getenv("PDF_STORAGE_DIR", "/app/db/pdf"))


def _get_qdrant_url() -> str:
    return os.getenv("QDRANT_URL", "http://qdrant:6333").rstrip("/")


def _get_collection_name() -> str:
    return os.getenv("QDRANT_COLLECTION", "publication_pdf_chunks").strip()


def _get_embedding_model_name() -> str:
    return os.getenv("AI_EMBEDDING_MODEL", "intfloat/multilingual-e5-large").strip()


def _get_embedding_cache_dir() -> str | None:
    value = os.getenv("AI_EMBEDDING_CACHE_DIR", "").strip()
    return value or None


@lru_cache(maxsize=1)
def _get_fastembed_model():  # type: ignore[return]
    from fastembed import TextEmbedding  # noqa: PLC0415

    return TextEmbedding(
        model_name=_get_embedding_model_name(),
        cache_dir=_get_embedding_cache_dir(),
    )


@lru_cache(maxsize=1)
def _get_qdrant_client() -> QdrantClient:
    return QdrantClient(url=_get_qdrant_url(), timeout=60)


def _ensure_collection(client: QdrantClient, collection_name: str, vector_size: int) -> None:
    if not client.collection_exists(collection_name):
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )


def index_article_pdf(article_id: int) -> dict:
    """
    Индексирует PDF одной статьи в Qdrant.

    Сначала удаляет все существующие чанки статьи (переиндексация),
    затем извлекает текст, создаёт эмбеддинги и загружает в Qdrant.

    Возвращает словарь со статусом операции.
    """
    pdf_path = _get_pdf_storage_dir() / f"{article_id}.pdf"

    if not pdf_path.is_file():
        return {
            "status": "not_found",
            "article_id": article_id,
            "chunks_count": 0,
            "message": f"PDF file not found: {pdf_path}",
        }

    # Извлекаем чанки
    chunks, index_status = _index_pdf_file(
        pdf_path,
        chunk_size=DEFAULT_CHUNK_SIZE,
        overlap_chars=DEFAULT_OVERLAP_CHARS,
    )

    client = _get_qdrant_client()
    collection_name = _get_collection_name()

    # Удаляем старые чанки этой статьи
    if client.collection_exists(collection_name):
        client.delete(
            collection_name=collection_name,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[
                        FieldCondition(
                            key="article_id",
                            match=MatchValue(value=article_id),
                        )
                    ]
                )
            ),
            wait=True,
        )

    if not chunks:
        return {
            "status": index_status.status,
            "article_id": article_id,
            "chunks_count": 0,
            "pages_count": index_status.pages_count,
            "error": index_status.error_message,
        }

    # Создаём эмбеддинги
    model = _get_fastembed_model()
    chunk_dicts = [
        {
            "article_id": c.article_id,
            "pdf_sha1": c.pdf_sha1,
            "page_number": c.page_number,
            "chunk_index": c.chunk_index,
            "text": c.text,
            "text_length": c.text_length,
        }
        for c in chunks
    ]
    passages = [f"passage: {c['text']}" for c in chunk_dicts]
    vectors = [v.tolist() for v in model.embed(passages)]

    _ensure_collection(client, collection_name, len(vectors[0]))

    # Загружаем батчами
    points = [
        PointStruct(
            id=_point_id(
                c["article_id"],
                c["pdf_sha1"],
                c["page_number"],
                c["chunk_index"],
            ),
            vector=v,
            payload=c,
        )
        for c, v in zip(chunk_dicts, vectors)
    ]
    for i in range(0, len(points), _EMBED_BATCH_SIZE):
        client.upsert(
            collection_name=collection_name,
            points=points[i : i + _EMBED_BATCH_SIZE],
            wait=True,
        )

    return {
        "status": "indexed",
        "article_id": article_id,
        "chunks_count": len(chunks),
        "pages_count": index_status.pages_count,
        "pdf_sha1": index_status.pdf_sha1,
    }
