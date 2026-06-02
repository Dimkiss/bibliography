# Bibliography

Веб-приложение для работы с библиографической базой: поиск публикаций, просмотр карточек, аналитика, авторизация, администрирование пользователей и добавление публикаций.

## Стек

- Backend: FastAPI, SQLAlchemy, PyMySQL, JWT
- AI service: FastAPI, Qdrant, FastEmbed, скрипты подготовки PDF-текста
- Database: MySQL 5.7
- Frontend: React 19, TypeScript, Vite, CSS Modules
- Charts: Recharts
- Docker: `docker compose`

## Быстрый запуск через Docker

1. Создать `.env` в корне проекта:

```env
SECRET_KEY=replace_with_a_random_64_hex_character_secret
```

Можно взять шаблон:

```powershell
Copy-Item .env.example .env
```

2. Запустить проект:

```powershell
docker compose up --build
```

3. Открыть:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- AI Swagger: http://localhost:8001/docs

При первом запуске MySQL импортирует дамп `db/bibl_new.sql` в базу `bibl_new`. Данные сохраняются в Docker volume `db-data`.

Чтобы пересоздать базу из дампа:

```powershell
docker compose down -v
docker compose up --build
```

## Локальный запуск

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

Создать `backend/.env`:

```env
DATABASE_URL=mysql+pymysql://root:root@127.0.0.1:3306/bibl_new
SECRET_KEY=replace_with_a_random_64_hex_character_secret
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Запуск:

```powershell
uvicorn app.main:app --reload
```

### Frontend

```powershell
cd frontend
npm install
npm.cmd run dev
```

Если PowerShell не блокирует `npm.ps1`, можно использовать обычный `npm run dev`.

Переменная API для фронтенда:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Если она не задана, используется `http://127.0.0.1:8000`.

### AI-сервис и PDF-индекс

AI-поиск работает отдельным сервисом `ai-agent`. В текущей конфигурации
`AI_LLM_ENABLED=false`, поэтому для обычного запуска `Ollama` не нужен.

RAG-поиск по PDF использует `Qdrant` и embedding-модель
`intfloat/multilingual-e5-large`. При первом старте модель может скачаться в
Docker volume `ai-model-cache`.

Обычный запуск AI-части:

```powershell
docker compose up -d --build qdrant ai-agent
```

Если готовый дамп `Qdrant` уже лежит в корне проекта как
`qdrant-data.tar.gz`, восстанови volume перед запуском:

```powershell
docker compose down
docker volume rm bibliography_qdrant-data
docker volume create bibliography_qdrant-data
docker run --rm --entrypoint tar -v bibliography_qdrant-data:/qdrant/storage -v "${PWD}:/backup" qdrant/qdrant:v1.15.5 -xzf /backup/qdrant-data.tar.gz -C /qdrant/storage
docker compose up -d --build qdrant ai-agent
```

Скрипты подготовки PDF-текста находятся в `backend-ai/scripts`.
Они не запускаются основным backend автоматически.

Аудит PDF и разделение на файлы со списками `article_id`:

```powershell
docker compose exec ai-agent python scripts/audit_pdf_text_layers.py --pdf-dir /app/db/pdf --output-dir /app/db/pdf_text_index --overwrite
```

Нарезка распознанных PDF на чанки:

```powershell
docker compose exec ai-agent python scripts/index_pdf_texts.py --pdf-dir /app/db/pdf --output-dir /app/db/pdf_text_index --article-ids-file /app/db/pdf_text_index/has_text_article_ids.txt --overwrite
```

Индексация готовых чанков в Qdrant:

```powershell
docker compose exec ai-agent python scripts/index_qdrant_pdf_chunks.py --index-dir /app/db/pdf_text_index --qdrant-url http://qdrant:6333 --collection publication_pdf_chunks --recreate --batch-size 128
```

Если `db/pdf_text_index/status.jsonl` и `db/pdf_text_index/chunks.jsonl` уже
подготовлены на другом компьютере, повторно резать PDF не нужно: достаточно
перенести каталог `db/pdf_text_index` и выполнить только индексацию в Qdrant.

## Проверки

Frontend:

```powershell
cd frontend
npm.cmd run lint
npm.cmd run build
```

`npm.cmd run build` может требовать разрешение на запуск `esbuild` в ограниченной среде. В обычном терминале Windows это, как правило, не требуется.

## Структура проекта

```text
backend/
  app/
    dependencies/   # зависимости FastAPI
    routers/        # HTTP роутеры
    schemas/        # Pydantic-схемы
    services/       # бизнес-логика
    main.py         # создание FastAPI app
  requirements.txt

backend-ai/
  app/              # AI API и планировщик поиска
  scripts/          # аудит PDF, нарезка PDF-текста, индексация в Qdrant
  requirements.txt

frontend/
  src/
    app/            # точка входа, App, глобальные стили
    pages/          # страницы маршрутов
    widgets/        # крупные блоки страниц
    features/       # пользовательские сценарии
    entities/       # бизнес-сущности
    shared/         # общие UI, assets, config, низкоуровневые lib
```

## Frontend FSD

Фронтенд приведен к Feature-Sliced Design.

Слои:

- `app` - инициализация приложения, root-компонент, глобальные стили.
- `pages` - страницы: `MainPage`, `LoginPage`, `PublicationsPage`, `PublicationDetailsPage`, `PublicationsCreatePage`, `ProfilePage`, `UserManagementPage`.
- `widgets` - самостоятельные блоки страниц: `Header`, `Footer`, `AnalyticsPanel`, `PublicationList`.
- `features` - сценарии: `auth`, `search-publications`, `create-publication`, `manage-users`.
- `entities` - бизнес-сущности: `publication`, `role`.
- `shared` - переиспользуемые элементы без бизнес-смысла: `ui`, `assets`, `config`, `lib/navigation`, `lib/auth`.

Правило зависимостей:

```text
app -> pages -> widgets -> features -> entities -> shared
```

Нижние слои не импортируют верхние. Для внешнего доступа у слайсов используются публичные `index.ts`.

## Инициализация справочников

После запуска backend можно вызвать:

```http
POST /init-data
```

Эндпоинт создает базовые роли и администратора, если их еще нет.

Доступ администратора по умолчанию:

```text
login: dimkiss
password: password
```

## Полезные ссылки

- Swagger: http://127.0.0.1:8000/docs
- Frontend dev server: http://localhost:5173
- Docker-инструкция: [DOCKER.md](./DOCKER.md)
