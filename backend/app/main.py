import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import engine, Base
from app.routers.health import router as health_router
from app.routers.auth import router as auth_router
from app.routers.init import router as init_router
from app.routers.admin_users import router as admin_users_router
from app.routers.admin_reference import router as admin_reference_router
from app.routers.admin_articles import router as admin_articles_router
from app.routers import articles
from app.routers import editions
from app.routers.analytics import router as analytics_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bibliography API")

origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(init_router)
app.include_router(admin_users_router)
app.include_router(admin_reference_router)
app.include_router(admin_articles_router)
app.include_router(articles.router)
app.include_router(editions.router)
app.include_router(analytics_router)
