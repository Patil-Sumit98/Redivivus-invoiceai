import logging
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.base import BaseHTTPMiddleware

from app.routers import auth, invoices, review, webhooks
import os

# ───────────────────────────────────────────────
# Application
# ───────────────────────────────────────────────
app = FastAPI(
    title="InvoiceAI API",
    description="AI-powered invoice processing for Indian GST compliance",
    version="1.0.0",
)

# ───────────────────────────────────────────────
# Security Headers Middleware
# ───────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ───────────────────────────────────────────────
# CORS
# ───────────────────────────────────────────────
if os.getenv("ENVIRONMENT", "dev") == "dev":
    origins = [
        "http://127.0.0.1:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5500",
        "http://localhost:5501",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://localhost:5173",   # Vite React dev server
        "http://127.0.0.1:5173",
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

# ───────────────────────────────────────────────
# Global Exception Handlers
# ───────────────────────────────────────────────
logger = logging.getLogger("invoiceai")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return clean 422 with field-level errors — never leak internals."""
    errors = []
    for err in exc.errors():
        loc = " → ".join(str(l) for l in err.get("loc", []))
        errors.append({"field": loc, "message": err.get("msg", "Invalid value")})
    return JSONResponse(status_code=422, content={"detail": "Validation error", "errors": errors})


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """Never expose raw DB errors to clients."""
    correlation_id = str(uuid.uuid4())[:8]
    logger.error(f"[{correlation_id}] Database error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "A database error occurred.", "correlation_id": correlation_id},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all: return correlation ID, log full traceback.
    BUG-33: Skip HTTPException — let FastAPI handle those natively."""
    from fastapi import HTTPException as _HTTPException
    if isinstance(exc, _HTTPException):
        raise exc
    correlation_id = str(uuid.uuid4())[:8]
    logger.error(f"[{correlation_id}] Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "correlation_id": correlation_id},
    )


# ───────────────────────────────────────────────
# Routers
# ───────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(invoices.router)
app.include_router(review.router)
app.include_router(webhooks.router)

# ───────────────────────────────────────────────
# Static Frontend (legacy HTML)
# ───────────────────────────────────────────────
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


# ───────────────────────────────────────────────
# Health Check
# ───────────────────────────────────────────────
@app.get("/health")
def health():
    """Health check — verifies API + DB + Azure config."""
    from app.database import SessionLocal
    from sqlalchemy import text

    db_status = "ok"
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        db_status = f"error: {str(e)[:200]}"

    azure_status = "configured"
    try:
        from app.config import settings
        if not settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT or not settings.AZURE_DOCUMENT_INTELLIGENCE_KEY:
            azure_status = "not_configured"
    except Exception:
        azure_status = "not_configured"

    overall = "ok" if db_status == "ok" else "degraded"

    return {
        "status": overall,
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "dev"),
        "db": db_status,
        "azure_ai": azure_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }