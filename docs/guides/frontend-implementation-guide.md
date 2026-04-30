# InvoiceAI — Frontend Implementation Guide
### Single-file HTML frontend for the existing FastAPI backend
---

## Overview

This guide explains everything you need to connect and run the `invoiceai-frontend.html`
file with your existing backend. No build tools, no npm, no React — just one HTML file
that you open in a browser.

---

## 1. Pre-flight Checklist

Before opening the frontend, confirm all three of these pass:

```bash
# ① Backend is running
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# ② Database is migrated
alembic upgrade head

# ③ Health check responds
curl http://localhost:8000/health
# Expected: {"status":"ok","version":"1.0.0"}
```

If the health endpoint doesn't exist yet, add it to `app/main.py`:

```python
@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
```

---

## 2. CORS — Single Required Fix

The frontend HTML file is opened directly from disk (using the `file://` protocol).
Browsers send `Origin: null` for `file://` requests, which your current CORS setup blocks.

**Open `app/main.py` and replace the `origins` list:**

```python
import os

# Dev mode: allow all origins (safe — only runs locally)
# Production: replace with your actual deployed domain
ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")

if ENVIRONMENT == "dev":
    origins = ["*"]
else:
    origins = ["https://your-deployed-domain.com"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Restart the server after this change. **This is the only backend change required to make the frontend work.**

---

## 3. Create a Demo User

The frontend has a pre-filled demo hint. Create that user once using the API:

```bash
curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@invoiceai.in","password":"demo1234"}' | python3 -m json.tool
```

Expected response:
```json
{
  "id": "some-uuid",
  "email": "demo@invoiceai.in",
  "api_key": "some-api-key"
}
```

---

## 4. Open the Frontend

Double-click `invoiceai-frontend.html` to open it in your browser.
Or from the terminal:

```bash
# macOS
open invoiceai-frontend.html

# Linux
xdg-open invoiceai-frontend.html

# Windows (PowerShell)
start invoiceai-frontend.html
```

You will see the sign-in screen. Log in with `demo@invoiceai.in / demo1234`.

---

## 5. API Endpoints the Frontend Uses

The frontend calls these exact backend routes. All are already implemented in your code.

| Method | Path | Used For |
|--------|------|----------|
| `POST` | `/auth/register` | Create new account |
| `POST` | `/auth/login` | Sign in, get JWT |
| `GET`  | `/auth/me` | Restore session on page reload |
| `POST` | `/invoices/upload` | Upload an invoice file |
| `GET`  | `/invoices/` | List all invoices (dashboard + list page) |
| `GET`  | `/invoices/stats` | Aggregate counts for stat cards |
| `GET`  | `/invoices/{id}` | Full invoice data for detail page |
| `GET`  | `/health` | API status indicator (top-right dot) |

The frontend handles a missing `/invoices/stats` endpoint gracefully — it will
derive stats from the list response if the stats endpoint doesn't exist yet.

---

## 6. Response Shape Reference

The frontend reads these exact fields from each response. Make sure your backend
returns them with these exact key names.

### GET /invoices/ → items array

Each item needs:
```json
{
  "id": "uuid-string",
  "status": "processing | completed | failed | pending",
  "original_filename": "invoice.pdf",
  "created_at": "2026-03-14T10:30:00",
  "confidence_score": 0.94,
  "vendor_name": "Reliance Industries Ltd",
  "total_amount": 100300.00,
  "invoice_number": "INV-2026-001"
}
```

If `original_filename` or `invoice_number` are missing from your list response,
the table will show `—` in those columns. To add them, update the `list_invoices`
function in `app/routers/invoices.py`:

```python
return {
    "items": [
        {
            "id": inv.id,
            "status": inv.status,
            "original_filename": inv.original_filename,       # add
            "created_at": inv.created_at,
            "confidence_score": inv.confidence,
            "vendor_name": inv.data_json.get("vendor_name", {}).get("value") if inv.data_json else None,
            "total_amount": inv.data_json.get("total_amount", {}).get("value") if inv.data_json else None,
            "invoice_number": inv.data_json.get("invoice_number", {}).get("value") if inv.data_json else None,  # add
        }
        for inv in invoices
    ],
    "total": total
}
```

### GET /invoices/{id} → full detail

```json
{
  "id": "uuid",
  "status": "completed",
  "file_url": "https://your-blob.azure.com/invoices/file.pdf",
  "original_filename": "gst-invoice-jan.pdf",
  "created_at": "2026-03-14T10:30:00",
  "confidence_score": 0.94,
  "error_message": null,
  "data": {
    "vendor_name":    { "value": "ABC Ltd",         "confidence": 0.98 },
    "vendor_gstin":   { "value": "29ABCDE1234F1Z5", "confidence": 0.97 },
    "invoice_number": { "value": "INV-001",          "confidence": 0.99 },
    "invoice_date":   { "value": "2026-01-15",        "confidence": 0.96 },
    "buyer_name":     { "value": "XYZ Pvt Ltd",      "confidence": 0.95 },
    "buyer_gstin":    { "value": "27ABCDE1234F1Z5", "confidence": 0.94 },
    "subtotal":       { "value": 85000.00,            "confidence": 0.97 },
    "cgst":           { "value": 7650.00,             "confidence": 0.96 },
    "sgst":           { "value": 7650.00,             "confidence": 0.96 },
    "igst":           { "value": 0.00,                "confidence": 0.95 },
    "total_amount":   { "value": 100300.00,           "confidence": 0.98 },
    "line_items": [
      {
        "description": "Software License Q1",
        "hsn_code": "998311",
        "quantity": 1,
        "rate": 85000.00,
        "amount": 85000.00
      }
    ]
  }
}
```

---

## 7. Background Task Bug Fix (Critical)

If every invoice shows `status: failed`, this is the most likely cause.
Your background task is using a closed database session.

**Replace the `process_invoice_task` function in `app/routers/invoices.py`:**

```python
from app.database import SessionLocal   # add this import at top

def process_invoice_task(invoice_id: str, file_bytes: bytes, filename: str):
    """Creates its own DB session — never reuses the HTTP request session."""
    db = SessionLocal()
    try:
        file_url = upload_file_to_blob(file_bytes, filename)
        raw_fields = analyze_invoice(file_url)
        mapped_data = map_fields(raw_fields)

        confidences = [
            v.get("confidence", 0.0)
            for v in mapped_data.values()
            if isinstance(v, dict) and "confidence" in v
        ]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if invoice:
            invoice.file_url = file_url
            invoice.raw_json = str(raw_fields)
            invoice.data_json = mapped_data
            invoice.confidence = round(avg_confidence, 4)
            invoice.status = "completed"
            db.commit()

    except Exception as e:
        print(f"[ERROR] Invoice {invoice_id}: {e}")
        db.rollback()
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if inv:
            inv.status = "failed"
            db.commit()
    finally:
        db.close()    # always close

# In the upload endpoint — remove the `db` parameter from add_task:
background_tasks.add_task(
    process_invoice_task,
    invoice_id=new_invoice.id,
    file_bytes=file_bytes,
    filename=file.filename
    # No db=db here
)
```

---

## 8. Route Order Fix

FastAPI matches routes in declaration order. `GET /invoices/stats` must come before
`GET /invoices/{invoice_id}` or FastAPI treats "stats" as an invoice ID.

**Correct order in `app/routers/invoices.py`:**

```
1. POST   /invoices/upload
2. GET    /invoices/stats     ← must be BEFORE /{invoice_id}
3. GET    /invoices/          ← list
4. GET    /invoices/{id}      ← detail — always last
```

---

## 9. Complete Updated invoices.py

Here is the full corrected router with all fixes applied:

```python
from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
import os

from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.invoice import Invoice
from app.middleware.auth import get_current_user
from app.services.blob_storage import upload_file_to_blob
from app.services.azure_ai import analyze_invoice
from app.services.invoice_mapper import map_fields

router = APIRouter(prefix="/invoices", tags=["Invoices"])

ALLOWED = {'.pdf', '.jpg', '.jpeg', '.png'}
MAX_SIZE = 20 * 1024 * 1024


# ── Background task (own session) ─────────────────────────────
def process_invoice_task(invoice_id: str, file_bytes: bytes, filename: str):
    db = SessionLocal()
    try:
        file_url = upload_file_to_blob(file_bytes, filename)
        raw_fields = analyze_invoice(file_url)
        mapped_data = map_fields(raw_fields)

        confidences = [
            v.get("confidence", 0.0)
            for v in mapped_data.values()
            if isinstance(v, dict) and "confidence" in v
        ]
        avg = sum(confidences) / len(confidences) if confidences else 0.0

        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if inv:
            inv.file_url    = file_url
            inv.raw_json    = str(raw_fields)
            inv.data_json   = mapped_data
            inv.confidence  = round(avg, 4)
            inv.status      = "completed"
            db.commit()
    except Exception as e:
        print(f"[ERROR] {invoice_id}: {e}")
        db.rollback()
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if inv:
            inv.status = "failed"
            db.commit()
    finally:
        db.close()


# ── Upload ─────────────────────────────────────────────────────
@router.post("/upload", status_code=201)
async def upload_invoice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(400, f"File type '{ext}' not supported. Use PDF, JPG, or PNG.")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(413, "File exceeds 20 MB limit.")

    inv = Invoice(user_id=current_user.id, status="processing",
                  original_filename=file.filename)
    db.add(inv); db.commit(); db.refresh(inv)

    background_tasks.add_task(process_invoice_task, inv.id, data, file.filename)
    return {"id": inv.id, "status": inv.status}


# ── Stats (must be before /{id}) ───────────────────────────────
@router.get("/stats")
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Invoice).filter(Invoice.user_id == current_user.id)
    avg = db.query(sqlfunc.avg(Invoice.confidence)).filter(
        Invoice.user_id == current_user.id, Invoice.status == "completed"
    ).scalar()
    return {
        "total":           q.count(),
        "completed":       q.filter(Invoice.status == "completed").count(),
        "processing":      q.filter(Invoice.status == "processing").count(),
        "failed":          q.filter(Invoice.status == "failed").count(),
        "avg_confidence":  round(float(avg or 0), 4)
    }


# ── List ───────────────────────────────────────────────────────
@router.get("/")
def list_invoices(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rows = (
        db.query(Invoice)
        .filter(Invoice.user_id == current_user.id)
        .order_by(Invoice.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    total = db.query(Invoice).filter(Invoice.user_id == current_user.id).count()
    return {
        "items": [
            {
                "id":               r.id,
                "status":           r.status,
                "original_filename":r.original_filename,
                "created_at":       r.created_at,
                "confidence_score": r.confidence,
                "vendor_name":      r.data_json.get("vendor_name", {}).get("value") if r.data_json else None,
                "total_amount":     r.data_json.get("total_amount", {}).get("value") if r.data_json else None,
                "invoice_number":   r.data_json.get("invoice_number", {}).get("value") if r.data_json else None,
            }
            for r in rows
        ],
        "total": total
    }


# ── Detail (always last) ───────────────────────────────────────
@router.get("/{invoice_id}")
def get_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id
    ).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return {
        "id":                inv.id,
        "status":            inv.status,
        "file_url":          inv.file_url,
        "original_filename": inv.original_filename,
        "created_at":        inv.created_at,
        "confidence_score":  inv.confidence,
        "data":              inv.data_json,
        "error_message":     "Processing failed" if inv.status == "failed" else None
    }
```

---

## 10. Add original_filename to Invoice Model

If the `original_filename` column doesn't exist yet, add it:

**`app/models/invoice.py`** — add one line:
```python
original_filename = Column(String, nullable=True)
```

Then create and run the migration:
```bash
alembic revision --autogenerate -m "add_original_filename"
alembic upgrade head
```

---

## 11. Complete Startup Sequence

```bash
# From your project root every time you start

# 1. Activate virtual environment
source venv/bin/activate          # Mac/Linux
.\venv\Scripts\activate            # Windows

# 2. Install / update dependencies
pip install -r requirements.txt

# 3. Apply any pending migrations
alembic upgrade head

# 4. Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 5. Open the frontend (in a separate terminal or file explorer)
open invoiceai-frontend.html      # Mac
xdg-open invoiceai-frontend.html  # Linux
```

---

## 12. What Each Frontend Page Does

| Page | Route Triggered | What It Shows |
|------|----------------|---------------|
| **Dashboard** | `/invoices/stats` + `/invoices/` | 4 stat cards + recent invoice table |
| **Upload** | `POST /invoices/upload` + polling `GET /invoices/{id}` | Drag & drop zone with live progress bar, auto-redirects to detail on completion |
| **All Invoices** | `GET /invoices/` | Full table of every invoice, click any row for detail |
| **Invoice Detail** | `GET /invoices/{id}` | Vendor/Buyer cards, financials, line items table, confidence scores per field |

---

## 13. Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Login returns "Cannot reach the backend" | Server not running | Run `uvicorn app.main:app --reload` |
| Login returns 401 after register | Login form not auto-filled | Tab to register, register, then sign in on the login tab |
| All invoices show `status: failed` | Background task DB session bug | Apply the `process_invoice_task` fix from section 7 |
| Fields all show `—` in detail view | `data_json` is null in DB | Azure AI key/endpoint wrong in `.env` |
| Green dot in topbar is grey | `/health` endpoint missing | Add `@app.get("/health")` to `main.py` |
| CORS error in browser console | `origins = ["*"]` not set | Apply the CORS fix from section 2 |
| Stats cards show 0 for everything | `/invoices/stats` missing | Add the stats endpoint, or will fall back gracefully |
| File upload returns 404 | Wrong endpoint path | Confirm backend is at `http://localhost:8000` |

---

## 14. Testing the Full Flow

Follow these steps once everything is running to confirm the end-to-end pipeline works:

```
1. Open invoiceai-frontend.html
2. Sign in with demo@invoiceai.in / demo1234
3. Go to Upload page
4. Drop a GST invoice PDF (or any invoice image)
5. Watch the progress bar fill → "Azure AI analyzing…"
6. The page auto-redirects to Invoice Detail when complete
7. See: vendor name, GSTIN, invoice total, line items — all with confidence %
8. Go to Dashboard → stat cards update with the new invoice counted
9. Go to All Invoices → row appears in the table
```

If step 5 never completes (status stays "processing" forever), check the terminal
running uvicorn for error output. The most common cause is an invalid Azure endpoint
or key in `.env`.

---

*InvoiceAI Frontend Guide · For internal use · March 2026*
