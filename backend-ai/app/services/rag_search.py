from __future__ import annotations

import os
from collections import defaultdict
from functools import lru_cache
from typing import Any

from fastembed import TextEmbedding
from qdrant_client import QdrantClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.schemas.rag_search import RagChunkMatch, RagSearchRetrieval, RagSearchResponse
from app.schemas.search_plan import SearchPlanFilters, SearchPlanResponse
from app.services.search_planner import build_search_plan


DEFAULT_COLLECTION_NAME = "publication_pdf_chunks"
DEFAULT_EMBEDDING_MODEL = "intfloat/multilingual-e5-large"


def _is_rag_enabled() -> bool:
    return os.getenv("AI_RAG_ENABLED", "true").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _get_qdrant_url() -> str:
    return os.getenv("QDRANT_URL", "http://qdrant:6333").rstrip("/")


def _get_collection_name() -> str:
    return os.getenv("QDRANT_COLLECTION", DEFAULT_COLLECTION_NAME).strip()


def _get_embedding_model_name() -> str:
    return os.getenv("AI_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL).strip()


def _get_embedding_cache_dir() -> str | None:
    value = os.getenv("AI_EMBEDDING_CACHE_DIR", "").strip()
    return value or None


def _get_database_url() -> str | None:
    value = os.getenv("DATABASE_URL", "").strip()
    return value or None


@lru_cache(maxsize=1)
def _get_embedding_model() -> TextEmbedding:
    return TextEmbedding(
        model_name=_get_embedding_model_name(),
        cache_dir=_get_embedding_cache_dir(),
    )


@lru_cache(maxsize=1)
def _get_qdrant_client() -> QdrantClient:
    return QdrantClient(url=_get_qdrant_url(), timeout=30)


@lru_cache(maxsize=1)
def _get_db_engine() -> Engine | None:
    database_url = _get_database_url()
    if not database_url:
        return None

    return create_engine(database_url, pool_pre_ping=True)


def _build_retrieval_query(
    message: str,
    plan: SearchPlanResponse,
    filters: SearchPlanFilters,
) -> str | None:
    candidates = [
        plan.semantic.query,
        filters.pdf_text_query,
        filters.text_query,
        filters.refine_text_query,
        filters.title,
        " ".join(filters.keyword),
        message,
    ]

    for candidate in candidates:
        if candidate and candidate.strip():
            return candidate.strip()

    return None


def _embed_query(query: str) -> list[float]:
    # E5-family models work better with the query/passage prefixes.
    embedded = list(_get_embedding_model().embed([f"query: {query}"]))
    if not embedded:
        raise RuntimeError("Embedding model returned no vectors.")

    return embedded[0].tolist()


def _payload_int(payload: dict[str, Any], name: str) -> int:
    value = payload.get(name)
    return int(value) if value is not None else 0


def _payload_text(payload: dict[str, Any]) -> str:
    text = str(payload.get("text") or "")
    max_chars = int(os.getenv("AI_RAG_SNIPPET_CHARS", "900"))
    if len(text) <= max_chars:
        return text

    return text[:max_chars].rstrip() + "..."


def _filter_existing_article_ids(article_ids: list[int]) -> list[int]:
    if not article_ids:
        return []

    engine = _get_db_engine()
    if engine is None:
        return article_ids

    params = {
        f"article_id_{index}": article_id
        for index, article_id in enumerate(article_ids)
    }
    placeholders = ", ".join(f":article_id_{index}" for index in range(len(article_ids)))

    with engine.connect() as connection:
        rows = connection.execute(
            text(
                f"""
                SELECT Record_ID
                FROM articles
                WHERE Record_ID IN ({placeholders})
                """
            ),
            params,
        ).mappings().all()

    existing_ids = {int(row["Record_ID"]) for row in rows}
    return [article_id for article_id in article_ids if article_id in existing_ids]


def _search_chunks(query: str, limit: int) -> RagSearchRetrieval:
    client = _get_qdrant_client()
    collection_name = _get_collection_name()
    vector = _embed_query(query)
    search_limit = min(max(limit * 4, limit), 100)

    points = client.query_points(
        collection_name=collection_name,
        query=vector,
        limit=search_limit,
        with_payload=True,
    ).points

    matches_by_article: dict[int, list[RagChunkMatch]] = defaultdict(list)

    for point in points:
        payload = dict(point.payload or {})
        article_id = _payload_int(payload, "article_id")
        if article_id <= 0:
            continue

        matches_by_article[article_id].append(
            RagChunkMatch(
                article_id=article_id,
                page_number=_payload_int(payload, "page_number"),
                chunk_index=_payload_int(payload, "chunk_index"),
                score=float(point.score or 0),
                text=_payload_text(payload),
            )
        )

    candidate_article_ids = sorted(
        matches_by_article,
        key=lambda article_id: max(match.score for match in matches_by_article[article_id]),
        reverse=True,
    )
    article_ids = _filter_existing_article_ids(candidate_article_ids)[:limit]
    matches = [
        sorted(matches_by_article[article_id], key=lambda match: match.score, reverse=True)[0]
        for article_id in article_ids
    ]

    return RagSearchRetrieval(
        status="ok",
        query=query,
        article_ids=article_ids,
        matches=matches,
    )


def build_rag_search(
    message: str,
    current_filters: SearchPlanFilters | None = None,
    limit: int = 30,
) -> RagSearchResponse:
    plan = build_search_plan(message, current_filters=current_filters)

    if plan.intent != "search":
        return RagSearchResponse(plan=plan, retrieval=RagSearchRetrieval(status="skipped"))

    query = _build_retrieval_query(message, plan, plan.filters)
    if not query:
        return RagSearchResponse(plan=plan, retrieval=RagSearchRetrieval(status="skipped"))

    if not _is_rag_enabled():
        return RagSearchResponse(
            plan=plan,
            retrieval=RagSearchRetrieval(status="disabled", query=query),
        )

    try:
        retrieval = _search_chunks(query, limit=limit)
    except Exception as exc:
        retrieval = RagSearchRetrieval(
            status="error",
            query=query,
            error=str(exc),
        )

    if retrieval.article_ids:
        plan.filters.article_ids = retrieval.article_ids
        plan.semantic.query = query
        plan.semantic.scope = "metadata_and_pdf"
        plan.sort.by = "relevance"
        plan.sort.order = "desc"

    return RagSearchResponse(plan=plan, retrieval=retrieval)
