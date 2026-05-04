# Bibliography

Веб-приложение для работы с библиографической базой: поиск публикаций, просмотр карточек, аналитика, авторизация, администрирование пользователей и добавление публикаций.

## Стек

- Backend: FastAPI, SQLAlchemy, PyMySQL, JWT
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
