# Docker

This project can run in Docker with these services:

- `db`: MySQL 5.7 with the `bibl_new` database.
- `backend`: FastAPI on port `8000`.
- `ai-agent`: FastAPI AI search service on port `8001`.
- `qdrant`: vector database for PDF RAG search on port `6333`.
- `frontend`: Vite dev server on port `5173`.

## Start

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- AI Swagger: http://localhost:8001/docs

On the first run, MySQL imports `db/bibl_new.sql` automatically into the
`bibl_new` database. The imported data is then stored in the `db-data` Docker
volume.

During frontend development, files from `frontend/` are mounted into the
container. Vite applies changes after saving the file, usually without
restarting the container or rebuilding the image.

If dependencies in `frontend/package.json` or `frontend/package-lock.json`
change, refresh the container's `node_modules` volume:

```bash
docker compose run --rm --no-deps frontend npm ci
docker compose restart frontend
```

## Reset Database

To import `db/bibl_new.sql` again, remove the database volume and start the
stack:

```bash
docker compose down -v
docker compose up --build
```

## Configuration

Backend environment variables are defined in `docker-compose.yml`:

- `DATABASE_URL`
- `SECRET_KEY`
- `CORS_ORIGINS`

AI service environment variables are also defined in `docker-compose.yml`:

- `DATABASE_URL`
- `AI_LLM_ENABLED`
- `AI_RAG_ENABLED`
- `AI_EMBEDDING_MODEL`
- `AI_EMBEDDING_CACHE_DIR`
- `QDRANT_URL`
- `QDRANT_COLLECTION`

Frontend uses `VITE_API_BASE_URL`. In Docker it points to:

```text
http://127.0.0.1:8000
```

The production nginx image is still available from `frontend/Dockerfile` via the
final stage, but the default compose setup targets the `dev` stage for faster
local work.

## AI Search

The current compose configuration runs `ai-agent` without Ollama:

```text
AI_LLM_ENABLED=false
```

For normal startup, only `qdrant` and `ai-agent` are required:

```bash
docker compose up -d --build qdrant ai-agent
```

The embedding model is cached in the `ai-model-cache` Docker volume. On the
first run it may take time to download.

## PDF Text Index

PDF text indexing scripts live in `backend-ai/scripts` and run through the
`ai-agent` container. They write prepared JSONL files to `db/pdf_text_index`.

Audit PDFs and create article id lists:

```bash
docker compose exec ai-agent python scripts/audit_pdf_text_layers.py --pdf-dir /app/db/pdf --output-dir /app/db/pdf_text_index --overwrite
```

Extract and chunk PDFs that have a text layer:

```bash
docker compose exec ai-agent python scripts/index_pdf_texts.py --pdf-dir /app/db/pdf --output-dir /app/db/pdf_text_index --article-ids-file /app/db/pdf_text_index/has_text_article_ids.txt --overwrite
```

Index prepared chunks into Qdrant:

```bash
docker compose exec ai-agent python scripts/index_qdrant_pdf_chunks.py --index-dir /app/db/pdf_text_index --qdrant-url http://qdrant:6333 --collection publication_pdf_chunks --recreate --batch-size 128
```

If `db/pdf_text_index/status.jsonl` and `db/pdf_text_index/chunks.jsonl` were
already generated on another machine, copy that directory and run only the
Qdrant indexing command. Do not rerun chunking unless the PDF files or chunking
rules changed.

## Restore Qdrant Dump

If `qdrant-data.tar.gz` already exists in the project root, restore the named
volume before starting the stack:

```bash
docker compose down
docker volume rm bibliography_qdrant-data
docker volume create bibliography_qdrant-data
docker run --rm --entrypoint tar -v bibliography_qdrant-data:/qdrant/storage -v "${PWD}:/backup" qdrant/qdrant:v1.15.5 -xzf /backup/qdrant-data.tar.gz -C /qdrant/storage
docker compose up -d --build
```
