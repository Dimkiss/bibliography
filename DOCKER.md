# Docker

This project can run in Docker with three services:

- `db`: MySQL 5.7 with the `bibl_new` database.
- `backend`: FastAPI on port `8000`.
- `frontend`: built Vite app served by nginx on port `5173`.

## Start

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger: http://localhost:8000/docs

On the first run, MySQL imports `bibl_new.sql` automatically into the `bibl_new`
database. The imported data is then stored in the `db-data` Docker volume.

## Reset Database

To import `bibl_new.sql` again, remove the database volume and start the stack:

```bash
docker compose down -v
docker compose up --build
```

## Configuration

Backend environment variables are defined in `docker-compose.yml`:

- `DATABASE_URL`
- `SECRET_KEY`
- `CORS_ORIGINS`

Frontend uses `VITE_API_BASE_URL` at build time. In Docker it points to:

```text
http://127.0.0.1:8000
```
