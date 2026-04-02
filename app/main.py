from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.routers import auth, invoices
import os

app = FastAPI(
    title="InvoiceAI API",
    description="AI-powered invoice processing for Indian GST",
    version="1.0.0"
)

if os.getenv("ENVIRONMENT", "dev") == "dev":
    origins = [
        "http://127.0.0.1:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5500",
        "http://localhost:5501",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ]
else:
    origins = [
        "https://yourdomain.com",
        "http://localhost:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(invoices.router)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_ASSETS_DIR = FRONTEND_DIR / "assets"

if FRONTEND_ASSETS_DIR.exists():
    app.mount(
        "/frontend/assets",
        StaticFiles(directory=str(FRONTEND_ASSETS_DIR)),
        name="frontend-assets",
    )

@app.get("/")
def root():
    return {"message": "InvoiceAI API v1.0", "docs": "/docs", "frontend": "/frontend"}

@app.get("/frontend")
def frontend_app():
    index_file = FRONTEND_DIR / "index.html"
    if not index_file.exists():
        return {"message": "Frontend build not found"}
    return FileResponse(str(index_file))

@app.get("/health")
def health():
    """Health check — verifies API + DB connectivity."""
    from app.database import SessionLocal
    from sqlalchemy import text
    db_status = "ok"
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        db_status = f"error: {str(e)}"
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "version": "1.0.0",
        "db": db_status
    }