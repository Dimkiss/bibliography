# Bibliography Project

## Структура проекта

```
backend/   — FastAPI + БД
frontend/  — фронтенд (Vite / React)
```

---

## Запуск проекта

### 1. Backend

Перейти в папку:

```
cd backend
```

Создать виртуальное окружение:

```
python -m venv venv
```

Активировать:

**Windows:**

```
venv\Scripts\activate
```

Установить зависимости:

```
pip install -r requirements.txt
```

---

### 2. Настройка .env

Создать файл:

```
backend/.env
```

И добавить:

```
DATABASE_URL=mysql+pymysql://root:root@127.0.0.1:3306/bibl_new
```

---

### 3. Запуск backend

```
uvicorn app.main:app --reload
```

API будет доступен:

```
http://127.0.0.1:8000
```

Swagger:

```
http://127.0.0.1:8000/docs
```

---

## Frontend

Перейти в папку:

```
cd frontend
```

Установить зависимости:

```
npm install
```

Запуск:

```
npm run dev
```

---

## База данных

### 1. Создание базы

Зайти в MySQL:

```
mysql -u root -p
```

Создать БД:

```
CREATE DATABASE bibl_new;
```

---

### 2. Импорт дампа

Поместить файл дампа в корень проекта `/`:

```
mysql -u root -p bibl_new < dump.sql
```

---

### 3. Инициализация данных

После запуска backend:

```
POST /init-data
```

(создаст роли, пользователя-админа и т.д.)

---

## Доступ по умолчанию

Администратор:

```
login: dimkiss
password: password
```

---

## Полезное

* Backend: FastAPI
* ORM: SQLAlchemy
* Auth: JWT
* DB: MySQL
* Frontend: React