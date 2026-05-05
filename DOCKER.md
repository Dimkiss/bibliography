# Docker

This project can run in Docker with three services:

- `db`: MySQL 5.7 with the `bibl_new` database.
- `backend`: FastAPI on port `8000`.
- `frontend`: Vite dev server on port `5173`.

## Start

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger: http://localhost:8000/docs

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

Frontend uses `VITE_API_BASE_URL`. In Docker it points to:

```text
http://127.0.0.1:8000
```

The production nginx image is still available from `frontend/Dockerfile` via the
final stage, but the default compose setup targets the `dev` stage for faster
local work.
