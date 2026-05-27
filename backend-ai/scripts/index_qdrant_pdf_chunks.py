from __future__ import annotations

import argparse
import json
import os
import uuid
from itertools import islice
from pathlib import Path
from typing import Any, Iterable

from fastembed import TextEmbedding
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INDEX_DIR = PROJECT_ROOT / "db" / "pdf_text_index"
DEFAULT_COLLECTION_NAME = "publication_pdf_chunks"
DEFAULT_EMBEDDING_MODEL = "intfloat/multilingual-e5-large"
POINT_NAMESPACE = uuid.UUID("a995a8e0-5d6b-467b-b6e3-d70776d4f42d")


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


def normalize_chunk(row: dict[str, Any]) -> dict[str, Any]:
    text = str(row.get("text") or "").strip()
    return {
        "article_id": int(row["article_id"]),
        "pdf_sha1": str(row["pdf_sha1"]),
        "page_number": int(row["page_number"]),
        "chunk_index": int(row["chunk_index"]),
        "text": text,
        "text_length": int(row.get("text_length") or len(text)),
    }


def point_id(chunk: dict[str, Any]) -> str:
    value = (
        f"{chunk['article_id']}:"
        f"{chunk['pdf_sha1']}:"
        f"{chunk['page_number']}:"
        f"{chunk['chunk_index']}"
    )
    return str(uuid.uuid5(POINT_NAMESPACE, value))


def embed_passages(model: TextEmbedding, chunks: list[dict[str, Any]]) -> list[list[float]]:
    passages = [f"passage: {chunk['text']}" for chunk in chunks]
    return [vector.tolist() for vector in model.embed(passages)]


def ensure_collection(
    client: QdrantClient,
    collection_name: str,
    vector_size: int,
    recreate: bool,
) -> None:
    exists = client.collection_exists(collection_name)

    if exists and recreate:
        client.delete_collection(collection_name)
        exists = False

    if not exists:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )


def filter_existing_chunks(
    client: QdrantClient,
    collection_name: str,
    chunks: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    ids = [point_id(chunk) for chunk in chunks]
    existing_ids = {
        str(point.id)
        for point in client.retrieve(
            collection_name=collection_name,
            ids=ids,
            with_payload=False,
            with_vectors=False,
        )
    }
    pending_chunks = [
        chunk
        for chunk, current_point_id in zip(chunks, ids, strict=True)
        if current_point_id not in existing_ids
    ]

    return pending_chunks, len(chunks) - len(pending_chunks)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Embed prepared PDF chunks and upload them to Qdrant.",
    )
    parser.add_argument("--index-dir", type=Path, default=DEFAULT_INDEX_DIR)
    parser.add_argument(
        "--qdrant-url",
        default=os.getenv("QDRANT_URL", "http://qdrant:6333"),
    )
    parser.add_argument(
        "--collection",
        default=os.getenv("QDRANT_COLLECTION", DEFAULT_COLLECTION_NAME),
    )
    parser.add_argument(
        "--model",
        default=os.getenv("AI_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL),
    )
    parser.add_argument(
        "--cache-dir",
        default=os.getenv("AI_EMBEDDING_CACHE_DIR", "/app/model-cache"),
    )
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument(
        "--device",
        choices=("cpu", "cuda"),
        default=os.getenv("AI_EMBEDDING_DEVICE", "cpu"),
        help="Embedding execution device. Use cuda only in the GPU indexer image.",
    )
    parser.add_argument(
        "--recreate",
        action="store_true",
        help="Delete and recreate the Qdrant collection before indexing.",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Resume indexing by skipping chunks that already exist in Qdrant.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    chunks_path = args.index_dir / "chunks.jsonl"

    if not chunks_path.is_file():
        raise SystemExit(f"chunks.jsonl does not exist: {chunks_path}")

    if args.recreate and args.skip_existing:
        raise SystemExit("--recreate and --skip-existing cannot be used together.")

    providers = ["CUDAExecutionProvider"] if args.device == "cuda" else None
    model = TextEmbedding(
        model_name=args.model,
        cache_dir=args.cache_dir,
        providers=providers,
    )
    client = QdrantClient(url=args.qdrant_url.rstrip("/"), timeout=120)

    rows = (normalize_chunk(row) for row in read_jsonl(chunks_path))
    if args.limit is not None:
        rows = islice(rows, args.limit)

    uploaded_total = 0
    skipped_total = 0
    read_total = 0
    collection_ready = False

    for batch in batched(rows, args.batch_size):
        if not batch:
            continue

        read_total += len(batch)

        if args.skip_existing:
            if not client.collection_exists(args.collection):
                collection_ready = False
            else:
                batch, skipped_count = filter_existing_chunks(
                    client=client,
                    collection_name=args.collection,
                    chunks=batch,
                )
                skipped_total += skipped_count
                if skipped_count:
                    print(
                        f"Skipped existing chunks: {skipped_total}; "
                        f"read={read_total}, uploaded={uploaded_total}"
                    )

            if not batch:
                continue

        vectors = embed_passages(model, batch)
        if not vectors:
            continue

        if not collection_ready:
            ensure_collection(
                client=client,
                collection_name=args.collection,
                vector_size=len(vectors[0]),
                recreate=args.recreate,
            )
            collection_ready = True

        points = [
            PointStruct(
                id=point_id(chunk),
                vector=vector,
                payload=chunk,
            )
            for chunk, vector in zip(batch, vectors, strict=True)
        ]
        client.upsert(collection_name=args.collection, points=points, wait=True)
        uploaded_total += len(points)
        print(
            f"Uploaded chunks: {uploaded_total}; "
            f"skipped={skipped_total}, read={read_total}"
        )

    print(
        f"Done. uploaded_chunks={uploaded_total}, skipped_chunks={skipped_total}, "
        f"read_chunks={read_total}, collection={args.collection}, "
        f"qdrant_url={args.qdrant_url}, model={args.model}"
    )


if __name__ == "__main__":
    main()
