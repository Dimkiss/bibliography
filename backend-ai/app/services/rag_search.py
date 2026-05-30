from __future__ import annotations

import os
import re
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
DEFAULT_SCORE_THRESHOLD = 0.55
DEFAULT_RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


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


def _get_matches_per_article() -> int:
    value = os.getenv("AI_RAG_MATCHES_PER_ARTICLE", "3").strip()

    try:
        return max(1, min(int(value), 5))
    except ValueError:
        return 3


def _get_score_threshold() -> float:
    value = os.getenv("AI_RAG_SCORE_THRESHOLD", "").strip()
    try:
        return float(value) if value else DEFAULT_SCORE_THRESHOLD
    except ValueError:
        return DEFAULT_SCORE_THRESHOLD


@lru_cache(maxsize=1)
def _get_embedding_model() -> TextEmbedding:
    return TextEmbedding(
        model_name=_get_embedding_model_name(),
        cache_dir=_get_embedding_cache_dir(),
    )


@lru_cache(maxsize=1)
def _get_qdrant_client() -> QdrantClient:
    return QdrantClient(url=_get_qdrant_url(), timeout=30)


def _is_reranker_enabled() -> bool:
    return os.getenv("AI_RERANKER_ENABLED", "false").strip().lower() in {
        "1", "true", "yes", "on",
    }


def _get_reranker_model_name() -> str:
    return os.getenv("AI_RERANKER_MODEL", DEFAULT_RERANKER_MODEL).strip()


@lru_cache(maxsize=1)
def _get_reranker() -> Any | None:
    """Лениво загружает cross-encoder модель для реранкинга."""
    try:
        from sentence_transformers import CrossEncoder
        model_name = _get_reranker_model_name()
        cache_dir = _get_embedding_cache_dir()
        print(f"Loading reranker model: {model_name}")
        return CrossEncoder(model_name, cache_folder=cache_dir)
    except Exception as exc:
        print(f"Reranker model load failed: {exc}")
        return None


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
    # Приоритет: семантический запрос из плана → pdf запрос → общий текстовый запрос → остальное.
    # message убран из цепочки — он слишком широкий и может вызвать RAG там где не нужно.
    candidates = [
        plan.semantic.query,
        filters.pdf_text_query,
        filters.text_query,
        filters.refine_text_query,
        filters.title,
        " ".join(filters.keyword),
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


def _clean_snippet_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _query_terms(query: str) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()

    for raw_term in re.findall(r"[\w-]{4,}", query.lower(), flags=re.UNICODE):
        variants = [raw_term]
        if len(raw_term) >= 7:
            variants.append(raw_term[:6])

        for term in variants:
            if term in seen:
                continue

            seen.add(term)
            terms.append(term)

    return terms


def _find_relevant_position(text: str, query: str) -> int | None:
    lowered_text = text.lower()
    positions = [
        position
        for term in _query_terms(query)
        if (position := lowered_text.find(term)) >= 0
    ]

    return min(positions) if positions else None


def _slice_around_position(text: str, position: int, max_chars: int) -> str:
    start = max(0, position - max_chars // 3)
    end = min(len(text), start + max_chars)
    start = max(0, end - max_chars)

    if start > 0:
        boundary = max(
            text.rfind(". ", 0, start + 1),
            text.rfind("; ", 0, start + 1),
            text.rfind("! ", 0, start + 1),
            text.rfind("? ", 0, start + 1),
        )
        if boundary >= max(0, start - 80):
            start = boundary + 2

    if end < len(text):
        boundary = min(
            [
                candidate
                for candidate in (
                    text.find(". ", end),
                    text.find("; ", end),
                    text.find("! ", end),
                    text.find("? ", end),
                )
                if candidate >= 0
            ],
            default=-1,
        )
        if end <= boundary <= min(len(text), end + 80):
            end = boundary + 1

    snippet = text[start:end].strip()
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet.rstrip() + "..."

    return snippet


def _payload_text(payload: dict[str, Any], query: str) -> str:
    text = _clean_snippet_text(str(payload.get("text") or ""))
    max_chars = int(os.getenv("AI_RAG_SNIPPET_CHARS", "360"))
    if len(text) <= max_chars:
        return text

    relevant_position = _find_relevant_position(text, query)
    if relevant_position is not None:
        return _slice_around_position(text, relevant_position, max_chars)

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

    pdf_storage_dir = os.getenv("PDF_STORAGE_DIR", "/app/db/pdf").rstrip("/")

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

    import pathlib
    existing_ids: set[int] = set()
    for row in rows:
        article_id = int(row["Record_ID"])
        # Проверяем что PDF файл реально существует
        pdf_path = pathlib.Path(f"{pdf_storage_dir}/{article_id}.pdf")
        if pdf_path.is_file():
            existing_ids.add(article_id)

    return [article_id for article_id in article_ids if article_id in existing_ids]


def _get_qdrant_search_limit() -> int:
    """Максимум чанков за один запрос к Qdrant. Score threshold отсекает нерелевантное."""
    value = os.getenv("AI_RAG_QDRANT_LIMIT", "1000").strip()
    try:
        return max(100, int(value))
    except ValueError:
        return 1000


def _rerank_articles(
    query: str,
    matches_by_article: dict[int, list[RagChunkMatch]],
) -> dict[int, float]:
    """
    Переранжирует статьи через cross-encoder.
    Для каждой статьи берёт лучший чанк и оценивает пару (query, chunk_text).
    Возвращает словарь article_id → reranker_score.
    """
    reranker = _get_reranker()
    if reranker is None:
        # Fallback: используем max embedding score
        return {
            article_id: max(m.score for m in matches)
            for article_id, matches in matches_by_article.items()
        }

    # Берём лучший чанк каждой статьи для реранкинга
    pairs: list[tuple[str, str]] = []
    article_ids_order: list[int] = []

    for article_id, matches in matches_by_article.items():
        best_match = max(matches, key=lambda m: m.score)
        # Восстанавливаем полный текст чанка из payload (не обрезанный snippet)
        pairs.append((query, best_match.text))
        article_ids_order.append(article_id)

    scores = reranker.predict(pairs)

    return {
        article_id: float(score)
        for article_id, score in zip(article_ids_order, scores)
    }


def _search_chunks(query: str) -> RagSearchRetrieval:
    client = _get_qdrant_client()
    collection_name = _get_collection_name()
    vector = _embed_query(query)
    score_threshold = _get_score_threshold()
    qdrant_limit = _get_qdrant_search_limit()

    points = client.query_points(
        collection_name=collection_name,
        query=vector,
        limit=qdrant_limit,
        with_payload=True,
        score_threshold=score_threshold,
    ).points

    matches_by_article: dict[int, list[RagChunkMatch]] = defaultdict(list)
    # Дедупликация по sha1 текста чанка — один и тот же текст не показываем дважды
    # (актуально для сборников где один PDF разбит на несколько статей)
    seen_chunk_hashes: set[str] = set()

    for point in points:
        payload = dict(point.payload or {})
        article_id = _payload_int(payload, "article_id")
        if article_id <= 0:
            continue

        raw_text = str(payload.get("text") or "").strip()
        chunk_hash = raw_text[:200]  # первые 200 символов как ключ дедупликации
        if chunk_hash in seen_chunk_hashes:
            continue
        seen_chunk_hashes.add(chunk_hash)

        matches_by_article[article_id].append(
            RagChunkMatch(
                article_id=article_id,
                page_number=_payload_int(payload, "page_number"),
                chunk_index=_payload_int(payload, "chunk_index"),
                score=float(point.score or 0),
                text=_payload_text(payload, query),
            )
        )

    # Реранкинг: если включён — пересортировываем статьи через cross-encoder
    if _is_reranker_enabled() and matches_by_article:
        reranker_scores = _rerank_articles(query, matches_by_article)
        candidate_article_ids = sorted(
            matches_by_article,
            key=lambda aid: reranker_scores.get(aid, 0),
            reverse=True,
        )
    else:
        candidate_article_ids = sorted(
            matches_by_article,
            key=lambda article_id: max(m.score for m in matches_by_article[article_id]),
            reverse=True,
        )

    # Без ограничения по количеству — возвращаем все статьи выше порога релевантности
    article_ids = _filter_existing_article_ids(candidate_article_ids)
    matches = [
        match
        for article_id in article_ids
        for match in sorted(
            matches_by_article[article_id],
            key=lambda item: item.score,
            reverse=True,
        )[:_get_matches_per_article()]
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
    limit: int = 30,  # оставлен для совместимости с API, больше не используется в RAG
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
        retrieval = _search_chunks(query)
    except Exception as exc:
        retrieval = RagSearchRetrieval(
            status="error",
            query=query,
            error=str(exc),
        )

    # RAG результаты не перезаписывают plan.filters.article_ids —
    # они возвращаются отдельно в retrieval.
    # Основной бэкенд сам объединяет RAG и метапоиск.
    if retrieval.status == "ok":
        plan.semantic.query = query
        plan.sort.by = "relevance"
        plan.sort.order = "desc"

    return RagSearchResponse(plan=plan, retrieval=retrieval)
