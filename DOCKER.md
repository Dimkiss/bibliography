# Docker

This project can run in Docker with these services:

- `db`: MySQL 5.7 with the `bibl_new` database.
- `backend`: FastAPI on port `8000`.
- `ai-agent`: FastAPI AI search service on port `8001`.
- `ollama`: local LLM runtime on port `11434`.
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
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

Frontend uses `VITE_API_BASE_URL`. In Docker it points to:

```text
http://127.0.0.1:8000
```

The production nginx image is still available from `frontend/Dockerfile` via the
final stage, but the default compose setup targets the `dev` stage for faster
local work.

## Ollama Model

Pull the local model once after starting `ollama`:

```bash
docker compose up -d ollama
docker compose exec ollama ollama pull qwen2.5:3b-instruct
docker compose exec ollama ollama list
```

## PDF Text Index

PDF text indexing scripts live in `backend-ai/scripts` and run through the
`ai-agent` container. They write prepared JSONL files to `db/pdf_text_index` and
can import them into MySQL tables `pdf_index_status` and `pdf_text_chunks`.

Audit PDFs and create article id lists:

```bash
docker compose exec ai-agent python scripts/audit_pdf_text_layers.py --pdf-dir /app/db/pdf --output-dir /app/db/pdf_text_index --overwrite
```

Extract and chunk PDFs that have a text layer:

```bash
docker compose exec ai-agent python scripts/index_pdf_texts.py --pdf-dir /app/db/pdf --output-dir /app/db/pdf_text_index --article-ids-file /app/db/pdf_text_index/has_text_article_ids.txt --overwrite
```

Import prepared chunks into MySQL:

```bash
docker compose exec ai-agent python scripts/import_pdf_text_index.py --index-dir /app/db/pdf_text_index --overwrite
```

If `db/pdf_text_index/status.jsonl` and `db/pdf_text_index/chunks.jsonl` were
already generated on another machine, copy that directory and run only the import
command. Do not rerun chunking unless the PDF files or chunking rules changed.
