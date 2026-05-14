import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.publications import router as publications_router


app = FastAPI(title="Bibliography AI API")

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

app.include_router(publications_router)
