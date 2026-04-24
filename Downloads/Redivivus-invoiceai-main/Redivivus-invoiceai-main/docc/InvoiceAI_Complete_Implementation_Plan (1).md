# InvoiceAI — Complete Industry-Grade Implementation Plan
## From Current State → Investor-Ready MVP

---

## CURRENT STATE ANALYSIS

### ✅ What's Already Built (Backend)
| Component | Status | Quality |
|-----------|--------|---------|
| FastAPI skeleton + CORS | Done | Basic |
| SQLAlchemy models (User, Invoice) | Done | Single-tenant only |
| Auth: register / login / JWT / me | Done | Good |
| Invoice upload → Blob Storage → Azure AI | Done | Works, not production-grade |
| invoice_mapper.py (Azure fields → canonical) | Done | Good start |
| Alembic migrations | Done | Basic |
| Static HTML frontend (served by FastAPI) | Done | Not React |
| `/stats`, list, get, delete, reprocess endpoints | Done | Good |

### ❌ What's Missing (Gap Analysis)
| Component | Priority | Complexity |
|-----------|----------|------------|
| QR code detection (GST e-Invoice) | P0 | Medium |
| Confidence routing (AUTO_APPROVED / NEEDS_REVIEW / HUMAN_REQUIRED) | P0 | Low |
| GST Rules Engine (GSTIN checksum, math, HSN) | P0 | Medium |
| Image preprocessing (deskew, denoise) | P1 | Medium |
| Idempotency keys on upload | P1 | Low |
| Structured logging (tenant_id, invoice_id, trace_id) | P1 | Low |
| Webhook delivery system | P1 | Medium |
| Human review queue API | P1 | Medium |
| Export to CSV / XLSX | P2 | Low |
| React 18 + TypeScript frontend | P0 | High |
| Dockerfile + docker-compose | P1 | Low |
| GitHub Actions CI/CD | P2 | Medium |
| Azure Bicep IaC | P2 | Medium |
| Rate limiting per user | P1 | Low |
| Processing time tracking | P2 | Low |
| Azure Service Bus (replace BackgroundTasks) | P3 | High |
| Multi-tenant schema isolation | P3 | High |

---

## WEEKLY IMPLEMENTATION PLAN

---

## WEEK 1 — Backend Hardening: QR Detection, Confidence Engine, GST Validation

**Goal:** Make the backend production-grade. Add QR detection, confidence routing, GST rules, idempotency, and structured logging. All work is on the existing Python codebase.

---

### STEP 1.1 — Add QR Detection Libraries and Module

**What to do:** Install QR detection libraries and create `app/services/qr_detector.py` that scans invoice files for GST e-Invoice QR codes before sending to Azure AI. If a QR is found, parse the GST JSON directly — zero AI cost, 100% accuracy.

**Why:** Per documentation, 35–40% of real Indian GST invoices contain QR codes. Detecting these first saves Azure AI credits and gives perfect accuracy.

**Files to create/modify:**
- Create: `app/services/qr_detector.py`
- Modify: `requirements.txt` (add opencv-python, pyzbar, Pillow, pymupdf)

**Agent Prompt:**
```
You are working on the InvoiceAI FastAPI backend (Python 3.11+).

Task: Create app/services/qr_detector.py

This module should:
1. Accept a file as bytes and filename (e.g., invoice.pdf or invoice.jpg)
2. For PDFs: use pymupdf (fitz) to render the first page as an image at 2x zoom
3. For images: load directly with Pillow
4. Use pyzbar to detect and decode QR codes
5. If a QR code is found, attempt to parse the GST e-Invoice format:
   - GST QR codes are JWTs: split by ".", base64-decode the payload
   - If not JWT, try plain JSON parse
   - Return the dict if successful, None otherwise
6. Handle all errors gracefully — return None on any failure, never raise

The return type should be Optional[dict]. If None, the caller falls back to Azure AI OCR.

Add these to requirements.txt:
- opencv-python==4.9.0.80
- pyzbar==0.1.9
- Pillow==10.3.0
- pymupdf==1.24.0

Include proper docstrings on every function. Handle: PDF first page, multi-page PDFs (only scan page 1), JPG/PNG/TIFF images. Log a warning (using Python logging module, not print()) when QR is detected or not detected.
```

**Definition of Done:**
- [ ] `detect_gst_qr(file_bytes: bytes, filename: str) -> Optional[dict]` exists
- [ ] Returns parsed dict for a real GST QR invoice
- [ ] Returns None for a non-QR invoice without crashing
- [ ] No `print()` statements — only `logging`

---

### STEP 1.2 — Confidence Engine Module

**What to do:** Create `app/services/confidence_engine.py` that takes the mapped invoice data and computes a weighted confidence score, then routes to one of three statuses.

**Why:** Currently the backend sets `status = "completed"` on any successful Azure AI call. This is wrong — a 55% confidence invoice should go to human review, not auto-approve.

**Files to create:**
- Create: `app/services/confidence_engine.py`

**Agent Prompt:**
```
You are working on the InvoiceAI FastAPI backend (Python 3.11+).

Task: Create app/services/confidence_engine.py

This module computes a weighted confidence score from the canonical invoice data dict and routes to the correct status.

Rules:
1. Field weights (higher = more important):
   - total_amount: weight 3
   - vendor_gstin: weight 2
   - invoice_date: weight 2
   - invoice_number: weight 2
   - line_items (any present): weight 2
   - vendor_name: weight 1
   - buyer_name: weight 1
   - subtotal: weight 1

2. For each field in the data dict that has a "confidence" key, extract it.
3. Compute: weighted_score = sum(field_weight * field_confidence) / sum(all_weights_of_present_fields)
4. If a field's value is None, treat its confidence as 0.0
5. Return a dataclass or dict with:
   - overall_score: float (0.0 to 1.0)
   - status: str → "AUTO_APPROVED" if score >= 0.90, "NEEDS_REVIEW" if 0.60 <= score < 0.90, "HUMAN_REQUIRED" if < 0.60
   - field_scores: dict mapping field name to its confidence

Expose one public function:
  compute_confidence(mapped_data: dict) -> dict

The returned dict must have keys: overall_score, status, field_scores

Include unit-testable pure functions. No external dependencies beyond Python stdlib.
```

**Definition of Done:**
- [ ] `compute_confidence({})` returns `{"overall_score": 0.0, "status": "HUMAN_REQUIRED", "field_scores": {}}`
- [ ] High-quality invoice → AUTO_APPROVED
- [ ] Low-quality → HUMAN_REQUIRED

---

### STEP 1.3 — GST Rules Engine

**What to do:** Create `app/services/gst_rules.py` with all GST validation rules from the MVP plan. This runs after AI extraction and flags compliance issues.

**Why:** This is InvoiceAI's core value-add over raw OCR. GSTIN checksum validation, math cross-checks, and place-of-supply matching are what enterprises care about.

**Files to create:**
- Create: `app/services/gst_rules.py`

**Agent Prompt:**
```
You are working on the InvoiceAI FastAPI backend (Python 3.11+).

Task: Create app/services/gst_rules.py

Implement ALL of the following GST validation rules:

1. GSTIN Format Validation:
   - Must be exactly 15 characters
   - Format: 2 digits (state code) + 10 alphanumeric (PAN) + 1 char (entity) + "Z" + 1 check digit
   - State codes 01-37 are valid
   - Return: {"valid": bool, "error": str or None}

2. GSTIN Luhn-style Check Digit:
   - Use the GSTN check digit algorithm:
     chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
     Factor alternates between 1 and 2 (like Luhn)
     Sum = sum of (char_value * factor), where char_value is index in chars string
     If product >= len(chars): product = (product // len(chars)) + (product % len(chars))
     check_digit = (len(chars) - (sum % len(chars))) % len(chars)
     Compare with last character of GSTIN
   - Return: {"valid": bool, "error": str or None}

3. Tax Math Cross-Check:
   - If CGST and SGST present: they must be approximately equal (within ₹1 tolerance)
   - If IGST present: CGST and SGST should be 0 or None
   - If both CGST and IGST have values: flag as suspicious
   - Return: {"valid": bool, "error": str or None}

4. Line Item Math Validation:
   - For each line item: quantity * rate should approximately equal amount (within ₹1)
   - Sum of all line amounts should approximately equal subtotal (within ₹1)
   - subtotal + total_tax should approximately equal total_amount (within ₹1)
   - Return: {"valid": bool, "errors": list[str]}

5. Invoice Date Validation:
   - Invoice date must not be more than 180 days in the past
   - Invoice date must not be in the future
   - Return: {"valid": bool, "error": str or None}

6. State Match (Place of Supply):
   - Extract first 2 digits from vendor GSTIN and buyer GSTIN
   - If they match: should use CGST+SGST (intra-state)
   - If they differ: should use IGST (inter-state)
   - Return: {"valid": bool, "suggestion": str}

Expose one public function:
  run_gst_rules(mapped_data: dict) -> dict
  Returns: {"passed": bool, "rules": {rule_name: result_dict}, "flags": list[str]}

All functions must be pure (no I/O), fully unit-testable, with comprehensive docstrings.
Use only Python stdlib (datetime, re, decimal). No external dependencies.
```

**Definition of Done:**
- [ ] Valid GSTIN (e.g., "29ABCDE1234F1Z5") passes
- [ ] Invalid GSTIN fails with descriptive error
- [ ] Math check catches when line_total ≠ quantity × rate
- [ ] All 6 rules implemented

---

### STEP 1.4 — Update Invoice Processing Pipeline

**What to do:** Refactor `app/routers/invoices.py` to use the new QR detector, confidence engine, and GST rules engine in the processing pipeline. Also add idempotency key support and structured logging.

**Why:** Wires all new modules together. Currently the pipeline is: blob → azure_ai → map_fields → done. It needs to be: QR check → (if no QR) azure_ai → map_fields → gst_rules → confidence → route.

**Files to modify:**
- Modify: `app/routers/invoices.py`
- Modify: `app/models/invoice.py` (add fields: source_type, ingestion_method, gst_rules_json, idempotency_key)
- Create new Alembic migration

**Agent Prompt:**
```
You are working on the InvoiceAI FastAPI backend (Python 3.11+).

Task: Refactor the invoice processing pipeline in app/routers/invoices.py and related files.

PART A — Update app/models/invoice.py:
Add these columns to the Invoice model:
- source_type: String (values: "GST_EINVOICE", "GST_PDF", "NON_GST", "HANDWRITTEN", "UNKNOWN")
- ingestion_method: String (values: "QR", "OCR", "HUMAN")  
- gst_rules_json: JSON (stores the output of run_gst_rules())
- idempotency_key: String(64), nullable, unique, indexed
- processing_time_ms: Integer, nullable

PART B — Create Alembic migration:
Generate a migration file at alembic/versions/ that adds these 5 columns to the invoices table.
Migration name: "add_pipeline_fields_to_invoices"

PART C — Refactor app/routers/invoices.py:

Replace the process_invoice_task function with this complete pipeline:

```python
def process_invoice_task(invoice_id: str, file_bytes: bytes, filename: str):
    import time, logging
    logger = logging.getLogger(__name__)
    start_time = time.monotonic()
    db = SessionLocal()
    try:
        logger.info(f"[invoice:{invoice_id}] Processing started")
        
        # STEP 1: QR Detection (try first — zero AI cost)
        from app.services.qr_detector import detect_gst_qr
        from app.services.invoice_mapper import map_fields
        from app.services.confidence_engine import compute_confidence
        from app.services.gst_rules import run_gst_rules
        from app.services.blob_storage import upload_file_to_blob
        from app.services.azure_ai import analyze_invoice
        
        qr_data = detect_gst_qr(file_bytes, filename)
        
        if qr_data:
            # QR path — map GST JSON directly, no Azure AI needed
            logger.info(f"[invoice:{invoice_id}] QR code detected — skipping Azure AI")
            mapped_data = map_gst_qr_to_canonical(qr_data)
            source_type = "GST_EINVOICE"
            ingestion_method = "QR"
            file_url = upload_file_to_blob(file_bytes, filename)
        else:
            # OCR path — upload then Azure AI
            logger.info(f"[invoice:{invoice_id}] No QR — sending to Azure AI OCR")
            file_url = upload_file_to_blob(file_bytes, filename)
            raw_fields = analyze_invoice(file_url)
            mapped_data = map_fields(raw_fields)
            source_type = "GST_PDF"
            ingestion_method = "OCR"
        
        # STEP 2: GST Rules validation
        gst_result = run_gst_rules(mapped_data)
        
        # STEP 3: Confidence scoring and routing
        conf_result = compute_confidence(mapped_data)
        
        # STEP 4: Save
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if invoice:
            invoice.file_url = file_url
            invoice.data_json = mapped_data
            invoice.confidence = conf_result["overall_score"]
            invoice.status = conf_result["status"]
            invoice.source_type = source_type
            invoice.ingestion_method = ingestion_method
            invoice.gst_rules_json = gst_result
            invoice.processing_time_ms = elapsed_ms
            db.commit()
            logger.info(f"[invoice:{invoice_id}] Done. status={invoice.status} confidence={invoice.confidence} time={elapsed_ms}ms")
    except Exception as e:
        logger.error(f"[invoice:{invoice_id}] Failed: {e}", exc_info=True)
        db.rollback()
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if inv:
            inv.status = "HUMAN_REQUIRED"
            inv.error_detail = str(e)[:500]
            db.commit()
    finally:
        db.close()
```

Also create a helper function map_gst_qr_to_canonical(qr_data: dict) -> dict that maps the GST QR JSON fields to the same canonical format as map_fields() uses.

PART D — Add idempotency to POST /invoices/upload:
- Accept an optional X-Idempotency-Key header
- Before creating a new invoice, check if one with that key already exists for this user
- If yes, return the existing invoice (don't reprocess)
- Hash the key with SHA-256 before storing (never store raw key)
- If no key provided, process normally

PART E — Update the upload endpoint response:
Return: {"id": invoice_id, "status": "processing", "source_type": "UNKNOWN", "ingestion_method": "PENDING"}
Status codes: 202 Accepted for new uploads, 200 OK for idempotency hits

Set up Python logging at module level with format: "%(asctime)s %(levelname)s [%(name)s] %(message)s"
```

**Definition of Done:**
- [ ] QR invoice → status = "AUTO_APPROVED", ingestion_method = "QR"
- [ ] Blurry scan → status = "NEEDS_REVIEW" or "HUMAN_REQUIRED"
- [ ] Idempotency: same file + same key → same invoice_id returned
- [ ] `processing_time_ms` populated
- [ ] `gst_rules_json` populated with validation results

---

### STEP 1.5 — Human Review Queue API

**What to do:** Add API endpoints for the human review workflow. Reviewers can see invoices in the NEEDS_REVIEW queue, view them side-by-side with the original, edit fields, and mark as VERIFIED.

**Files to create/modify:**
- Create: `app/routers/review.py`
- Create: `app/models/review_log.py` (audit trail)
- Create new Alembic migration

**Agent Prompt:**
```
You are working on the InvoiceAI FastAPI backend (Python 3.11+).

Task: Create the human review queue API in app/routers/review.py

Create a ReviewLog SQLAlchemy model in app/models/review_log.py:
- id: String(36) UUID primary key
- invoice_id: String(36) FK to invoices.id
- reviewer_user_id: String(36) FK to users.id
- action: String (values: "APPROVED", "REJECTED", "EDITED")
- before_data: JSON (snapshot of data_json before edit)
- after_data: JSON (snapshot of data_json after edit)
- notes: Text, nullable
- created_at: DateTime with server_default=func.now()

Create a Pydantic schema ReviewSubmit:
- action: Literal["APPROVED", "REJECTED", "EDITED"]
- corrected_data: Optional[dict] = None (the full corrected data_json if action=EDITED)
- notes: Optional[str] = None

Create these endpoints in app/routers/review.py (prefix="/review"):

1. GET /review/queue
   - Returns paginated invoices where status IN ("NEEDS_REVIEW", "HUMAN_REQUIRED")
   - Filters to current_user's invoices
   - Returns: {"items": [...], "total": int, "page": int}
   - Include: id, status, confidence_score, original_filename, created_at, gst_flags (from gst_rules_json["flags"])

2. POST /review/{invoice_id}/submit
   - Body: ReviewSubmit
   - Validates invoice belongs to current user
   - Validates invoice is in NEEDS_REVIEW or HUMAN_REQUIRED status
   - Creates a ReviewLog record (stores before/after snapshot)
   - If action == "APPROVED": set invoice.status = "VERIFIED", invoice.ingestion_method = "HUMAN"
   - If action == "REJECTED": set invoice.status = "REJECTED"
   - If action == "EDITED": update invoice.data_json with corrected_data, recompute confidence, set status = "VERIFIED"
   - Returns updated invoice

3. GET /review/{invoice_id}/history
   - Returns all ReviewLog entries for an invoice
   - Validates invoice belongs to current user

Wire review.router into app/main.py with prefix /review.
Generate Alembic migration for review_logs table.
Use proper HTTP status codes (200, 201, 404, 400, 403).
Add structured logging on every action.
```

**Definition of Done:**
- [ ] GET /review/queue returns only NEEDS_REVIEW/HUMAN_REQUIRED invoices
- [ ] POST submit with EDITED action updates data_json and recomputes confidence
- [ ] ReviewLog records created for every action (immutable audit trail)
- [ ] History endpoint returns chronological review trail

---

### STEP 1.6 — Webhook Delivery System

**What to do:** Allow users to register webhook URLs. When an invoice completes processing (any final status), POST the canonical JSON to their registered webhook with HMAC-SHA256 signature.

**Files to create:**
- Create: `app/models/webhook.py`
- Create: `app/services/webhook_service.py`
- Create: `app/routers/webhooks.py`
- Create Alembic migration

**Agent Prompt:**
```
You are working on the InvoiceAI FastAPI backend (Python 3.11+).

Task: Build a webhook delivery system.

PART A — Create app/models/webhook.py:
Webhook model:
- id: String(36) UUID PK
- user_id: String(36) FK to users.id
- url: String(500) — the endpoint URL to POST to
- secret: String(64) — used for HMAC-SHA256 signing (store hashed? No, store raw — it's outbound)
- is_active: Boolean, default True
- events: JSON list (e.g., ["invoice.completed", "invoice.needs_review"])
- created_at: DateTime server_default
- updated_at: DateTime onupdate

WebhookDelivery model (delivery log):
- id: String(36) UUID PK
- webhook_id: String(36) FK to webhooks.id
- invoice_id: String(36) FK to invoices.id
- status: String ("pending", "delivered", "failed")
- http_status_code: Integer nullable
- response_body: Text nullable (truncated to 500 chars)
- attempts: Integer default 0
- last_attempt_at: DateTime nullable
- created_at: DateTime server_default

PART B — Create app/services/webhook_service.py:
Implement:

def compute_hmac_signature(payload_bytes: bytes, secret: str) -> str:
    """Returns hex HMAC-SHA256 signature for the payload."""
    import hmac, hashlib
    return hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()

def deliver_webhook(delivery_id: str):
    """
    Synchronous delivery function (called from background task).
    - Load delivery + webhook from DB (creates its own session)
    - POST the invoice canonical JSON to webhook.url
    - Set headers: Content-Type: application/json, X-InvoiceAI-Signature: sha256=<hmac>
    - On 2xx: mark delivery as "delivered"
    - On non-2xx or exception: increment attempts, if attempts < 3 retry after 5s
    - After 3 failures: mark as "failed"
    - All in try/except — never raise
    - Timeout: 10 seconds per request (use requests library)
    """

def trigger_webhooks_for_invoice(invoice_id: str, user_id: str, event: str):
    """
    Called after invoice processing completes.
    Finds all active webhooks for user_id that include event.
    Creates WebhookDelivery records.
    Schedules deliver_webhook() for each delivery.
    Uses its own DB session.
    """

PART C — Create app/routers/webhooks.py (prefix="/webhooks"):
Endpoints:
1. POST /webhooks — register new webhook (body: url, events list, secret)
2. GET /webhooks — list user's webhooks
3. DELETE /webhooks/{id} — soft delete (set is_active=False)
4. POST /webhooks/{id}/test — send a test payload to the webhook URL
5. GET /webhooks/{id}/deliveries — paginated delivery log with status/attempts

PART D — Wire webhook triggering into process_invoice_task in invoices.py:
After saving the final invoice status, call:
  trigger_webhooks_for_invoice(invoice_id, user_id, event="invoice.completed")

Generate Alembic migration for both new tables.
Add 'requests==2.32.5' to requirements if not already present.
```

**Definition of Done:**
- [ ] Webhook registered, invoice uploaded → webhook receives POST within 30s
- [ ] HMAC signature header present on every delivery
- [ ] Delivery log shows attempts, status, HTTP status code
- [ ] Test endpoint sends test payload immediately

---

### STEP 1.7 — Export Endpoints + Rate Limiting

**What to do:** Add CSV/XLSX export for invoices and add a simple in-memory rate limiter to protect the upload endpoint.

**Files to modify/create:**
- Modify: `app/routers/invoices.py` (add export endpoints)
- Create: `app/middleware/rate_limit.py`

**Agent Prompt:**
```
You are working on the InvoiceAI FastAPI backend (Python 3.11+).

Task A — Add export endpoints to app/routers/invoices.py:

Add:
GET /invoices/export/csv — returns all user invoices as CSV download
GET /invoices/export/xlsx — returns all user invoices as Excel download

Both endpoints:
- Require auth (current_user)
- Query all invoices for current_user (no pagination — export all)
- Include columns: id, original_filename, status, confidence_score, vendor_name, vendor_gstin, invoice_number, invoice_date, total_amount, created_at, processing_time_ms

For CSV: use Python's built-in csv module + io.StringIO, return StreamingResponse with media_type="text/csv", Content-Disposition: attachment; filename="invoices.csv"

For XLSX: use openpyxl to build a workbook in memory (io.BytesIO), return StreamingResponse with media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", Content-Disposition: attachment; filename="invoices.xlsx"
For XLSX: bold the header row, auto-size columns, freeze the header row.

Add openpyxl to requirements.txt.

Task B — Add simple rate limiting to app/middleware/rate_limit.py:

Create a simple in-memory rate limiter using a defaultdict:
- Store: {user_id: deque of timestamps}
- Limit: 100 requests per minute on /invoices/upload
- On exceed: raise HTTPException(429, "Rate limit exceeded. Max 100 uploads per minute.")
- Expose as a FastAPI dependency: check_rate_limit(current_user: User = Depends(get_current_user))
- Add this dependency to the POST /invoices/upload endpoint

Note: In-memory is fine for MVP. For production, use Redis.
```

**Definition of Done:**
- [ ] CSV download includes all invoice fields with proper headers
- [ ] XLSX has bold header, frozen pane, all columns populated
- [ ] 101st upload within 60s returns 429
- [ ] Rate limit resets after 60s

---

## WEEK 2 — React Frontend (Complete Dashboard)

**Goal:** Build a professional React 18 + TypeScript frontend from scratch. The existing static HTML frontend is functional but not production-grade. This week replaces it with a full SPA.

---

### STEP 2.1 — React Project Setup

**What to do:** Initialize the React + TypeScript project with Vite, install all dependencies, configure Tailwind and shadcn/ui, set up project structure, and configure the Axios client and environment variables.

**Agent Prompt:**
```
You are building the InvoiceAI React frontend from scratch.

Task: Initialize the project and set up all infrastructure.

Run these commands (provide the exact sequence):

1. npm create vite@latest invoiceai-frontend -- --template react-ts
2. cd invoiceai-frontend
3. npm install
4. npm install -D tailwindcss postcss autoprefixer
5. npx tailwindcss init -p
6. npx shadcn@latest init (choose: Default style, Slate base color, CSS variables: yes)
7. npm install axios @tanstack/react-query react-router-dom react-dropzone
8. npm install zustand react-hot-toast lucide-react date-fns
9. npm install -D @types/node

Install shadcn components:
npx shadcn@latest add button card input badge table dialog progress skeleton alert tabs separator

Create the full folder structure:
invoiceai-frontend/src/
├── api/
│   ├── client.ts        # Axios instance
│   └── invoices.ts      # API functions
├── components/
│   ├── ui/              # shadcn (auto-generated)
│   ├── FileDropzone.tsx
│   ├── InvoiceCard.tsx
│   ├── StatusBadge.tsx
│   ├── ConfidenceBar.tsx
│   ├── GSTRulesPanel.tsx
│   ├── LineItemsTable.tsx
│   └── Navbar.tsx
├── hooks/
│   ├── useUploadInvoice.ts
│   ├── useInvoiceStatus.ts
│   └── useInvoiceList.ts
├── layouts/
│   └── DashboardLayout.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── DashboardPage.tsx
│   ├── UploadPage.tsx
│   ├── InvoiceDetailPage.tsx
│   └── ReviewQueuePage.tsx
├── store/
│   └── authStore.ts
├── types/
│   └── index.ts
└── utils/
    └── formatters.ts

Create .env.local:
VITE_API_URL=http://localhost:8000

Create src/api/client.ts:
- Axios instance with baseURL from import.meta.env.VITE_API_URL
- Request interceptor: reads token from localStorage ("invoiceai_token"), adds Authorization: Bearer header
- Response interceptor: on 401, clears token from localStorage and redirects to /login

Create src/types/index.ts with full TypeScript interfaces matching the API contract:
- Invoice, InvoiceListItem, InvoiceData, ConfidenceField, LineItem
- User, AuthToken
- Stats, WebhookConfig, ReviewItem
- ApiError

Create src/utils/formatters.ts:
- formatCurrency(amount: number | null | undefined, currency?: string): string → "₹1,23,456.00"
- formatDate(dateStr: string | null | undefined): string → "15 Jan 2026"
- formatConfidence(score: number): string → "94.5%"
- getStatusColor(status: string): string → Tailwind color class
- formatGSTIN(gstin: string | null | undefined): string → formats with spaces for readability
```

**Definition of Done:**
- [ ] `npm run dev` starts without errors on localhost:5173
- [ ] `npm run build` produces zero TypeScript errors
- [ ] All folders and base files created
- [ ] Axios client sends auth header on protected calls
- [ ] 401 responses auto-clear token and redirect to /login

---

### STEP 2.2 — Auth Pages (Login + Register)

**What to do:** Build the Login and Register pages with form validation, connecting to the FastAPI auth endpoints. Manage JWT in Zustand store persisted to localStorage.

**Agent Prompt:**
```
You are building the InvoiceAI React frontend (React 18, TypeScript, Tailwind, shadcn/ui).

Task: Build authentication pages and state management.

PART A — Create src/store/authStore.ts (Zustand):
State:
- token: string | null
- user: { id: string; email: string } | null
- isAuthenticated: boolean (derived from token !== null)

Actions:
- login(token: string, user: {id: string, email: string}): void → sets state + persists to localStorage
- logout(): void → clears state + localStorage + calls navigate("/login")
- initFromStorage(): void → called on app mount, reads from localStorage

Persistence: key "invoiceai_token" for token, "invoiceai_user" for user object.

PART B — Create src/pages/LoginPage.tsx:
- Professional centered card layout
- Email + Password inputs (shadcn Input components)
- Submit button with loading spinner during API call
- On success: call authStore.login(), navigate to /dashboard
- On error: show toast notification with error message
- Link to Register page
- Call POST /auth/login with {email, password}
- Use React Query's useMutation

PART C — Create src/pages/RegisterPage.tsx:
- Same layout as login
- Fields: email, password, confirm password
- Client-side validation: email format, password min 8 chars, passwords match
- Show inline field errors (not toasts)
- On success: auto-login and navigate to /dashboard
- Call POST /auth/register, then POST /auth/login automatically

PART D — Create protected route wrapper:
src/components/ProtectedRoute.tsx:
- Reads isAuthenticated from authStore
- If not authenticated: redirect to /login
- If authenticated: render children
```

---

### STEP 2.3 — Dashboard Layout + Navigation

**What to do:** Build the persistent layout with sidebar navigation that wraps all authenticated pages.

**Agent Prompt:**
```
You are building the InvoiceAI React frontend.

Task: Build the authenticated dashboard layout and navigation.

Create src/layouts/DashboardLayout.tsx:
- Left sidebar (64px collapsed, 240px expanded on desktop)
- Sidebar items: Dashboard (home icon), Upload (upload icon), Invoice History (list icon), Review Queue (eye icon), Settings (settings icon)
- Top header bar: InvoiceAI logo + current user email + logout button
- Main content area with <Outlet /> from react-router-dom
- Active route highlighted in sidebar
- On mobile (<768px): sidebar hidden, hamburger menu shows overlay

Create src/components/Navbar.tsx for the top bar.

Create src/App.tsx with full routing:
- / → redirect to /dashboard
- /login → <LoginPage /> (no auth required)
- /register → <RegisterPage /> (no auth required)  
- /dashboard → <ProtectedRoute><DashboardLayout><DashboardPage /></></> 
- /upload → <ProtectedRoute><DashboardLayout><UploadPage /></></>
- /invoices → <ProtectedRoute><DashboardLayout><InvoicesPage /></></>
- /invoices/:id → <ProtectedRoute><DashboardLayout><InvoiceDetailPage /></></>
- /review → <ProtectedRoute><DashboardLayout><ReviewQueuePage /></></>

Design: clean, professional. Use Tailwind slate-900 sidebar, white content area.
Stats cards on dashboard: green/blue/amber/red for auto-approved/processing/needs_review/failed.
```

---

### STEP 2.4 — Upload Page + File Dropzone

**What to do:** Build the invoice upload page with drag-and-drop, real-time status polling, and confidence display after completion.

**Agent Prompt:**
```
You are building the InvoiceAI React frontend.

Task: Build the Upload page and invoice status tracking.

PART A — Create src/components/FileDropzone.tsx:
- Uses react-dropzone
- Accepts: PDF, JPG, JPEG, PNG (max 20MB)
- Visual states:
  - Idle: dashed border with upload icon and "Drag invoice here or click to browse"
  - Drag active: blue border + blue background
  - Uploading: spinner + "Uploading..."
  - Error: red border + error message
- Shows file preview info (name, size) after selection
- Single file only
- On invalid file type: show error in component (not navigate away)

PART B — Create src/hooks/useUploadInvoice.ts:
- Uses useMutation from React Query
- Calls POST /invoices/upload with FormData
- Sets X-Idempotency-Key header (generate UUID v4 on each upload attempt)
- On success: navigate to /invoices/{invoice_id}
- On error: show toast with error message

PART C — Create src/pages/UploadPage.tsx:
- Shows FileDropzone
- Below: a "How it works" info section explaining QR detection → AI OCR → confidence scoring
- Shows recent uploads (last 5) as compact cards below the dropzone

PART D — Create src/hooks/useInvoiceStatus.ts:
- Calls GET /invoices/{id} 
- Uses React Query's refetchInterval
- Polls every 2 seconds while status is "processing"
- Stops polling when status is in ["AUTO_APPROVED", "NEEDS_REVIEW", "HUMAN_REQUIRED", "VERIFIED", "REJECTED", "failed", "completed"]

PART E — Create src/components/StatusBadge.tsx:
- Auto-approved: green badge
- Needs Review: yellow/amber badge  
- Human Required: red badge
- Processing: blue badge with spinning animation
- Verified: dark green badge with checkmark
- Rejected: red badge with X

PART F — Create src/components/ConfidenceBar.tsx:
- Props: score (0-1 float)
- Renders a horizontal bar
- Color: green if >= 0.90, yellow if >= 0.60, red if < 0.60
- Shows percentage text (e.g., "94.5%")
- Smooth width transition animation
```

---

### STEP 2.5 — Invoice Detail Page

**What to do:** The most complex page — shows the complete extracted invoice data, GST validation results, line items, and the original file viewer side by side.

**Agent Prompt:**
```
You are building the InvoiceAI React frontend.

Task: Build the complete Invoice Detail Page.

Create src/pages/InvoiceDetailPage.tsx:
- Uses useParams to get invoice_id
- Uses useInvoiceStatus hook for polling
- Layout: two columns on desktop (original file on left, extracted data on right), stacked on mobile

LEFT COLUMN — Original Document Viewer:
- If file_url is a PDF: render <iframe src={file_url} width="100%" height="700px">
- If file_url is an image: render <img src={file_url} max-height="700px">
- Show original filename and upload date below

RIGHT COLUMN — Extracted Data:
Tabs: "Invoice Data" | "GST Validation" | "Line Items" | "Raw JSON"

Tab 1 — Invoice Data:
- Show fields in a clean grid:
  - Vendor Name + GSTIN (source badge: QR or OCR)
  - Buyer Name + GSTIN
  - Invoice Number + Date + Due Date
  - Subtotal / CGST / SGST / IGST / Total
- Each field shows: value + ConfidenceBar for its confidence score
- Fields with confidence < 0.60 highlighted in red (needs verification)
- IngestionMethod badge: "QR Code (100% accurate)" or "Azure AI OCR"

Tab 2 — GST Validation:
Create src/components/GSTRulesPanel.tsx:
- Shows results of gst_rules_json from the invoice
- Each rule: rule name, passed/failed icon, details
- Rules: GSTIN Format, GSTIN Checksum, Tax Math, Line Item Math, Date Validity, State Match
- Color: green checkmark if passed, red X if failed, gray dash if not applicable

Tab 3 — Line Items:
Create src/components/LineItemsTable.tsx:
- Table with columns: #, Description, HSN Code, Qty, Rate (₹), Amount (₹)
- Formatted with Indian currency
- Footer row showing total
- Empty state: "No line items extracted"

Tab 4 — Raw JSON:
- <pre> block with JSON.stringify(invoice.data, null, 2)
- Copy to clipboard button

BOTTOM BAR (for NEEDS_REVIEW / HUMAN_REQUIRED):
- "This invoice needs manual review" banner
- Button: "Open Review" → navigates to /review queue
```

---

### STEP 2.6 — Invoice List + Dashboard Stats

**What to do:** Build the invoice list page with filters and the dashboard home page with stats cards and charts.

**Agent Prompt:**
```
You are building the InvoiceAI React frontend.

Task: Build the Invoice List page and Dashboard home page.

PART A — Create src/pages/InvoicesPage.tsx:
- Paginated table of all invoices
- Columns: Filename, Vendor, Invoice #, Date, Total, Status, Confidence, Actions
- Status column uses StatusBadge component
- Confidence column uses ConfidenceBar (compact version)
- Actions: View (eye icon) → navigates to detail | Delete (trash icon) → confirms then deletes
- Filter bar at top: filter by status (All / Processing / Auto-Approved / Needs Review)
- Search box: filter by vendor name or invoice number (client-side filtering)
- Sort by: Date (default desc), Confidence, Total Amount
- Pagination: 20 per page, show total count

PART B — Create src/pages/DashboardPage.tsx:
Stats row (4 cards):
- Total Invoices: blue, with DocumentText icon
- Auto-Approved: green, with CheckCircle icon (shows count + percentage of total)
- Needs Review: amber, with ExclamationCircle icon
- Failed / Human Required: red, with XCircle icon

Below stats, add recent invoices table (last 10):
- Compact version of invoice list
- "View All" link

Add a simple visual using CSS (no chart library needed):
- Processing method breakdown: "X% via QR Code | Y% via AI OCR"
- Shown as two colored horizontal bars

Bottom section: "Quick Tips" card explaining QR detection advantage
```

---

### STEP 2.7 — Review Queue Page

**What to do:** Build the human review interface where reviewers can see flagged invoices, compare with original, edit fields, and approve/reject.

**Agent Prompt:**
```
You are building the InvoiceAI React frontend.

Task: Build the Review Queue page.

Create src/pages/ReviewQueuePage.tsx:
- Fetches GET /review/queue
- Shows invoices needing review in a prioritized list
- Each item: filename, confidence score, GST flags count, time since upload
- Click → opens the review modal

Create src/components/ReviewModal.tsx (Dialog from shadcn):
- Full-screen overlay
- Left panel: iframe/img showing original invoice (same as detail page)
- Right panel: editable form of extracted fields

Editable fields:
- Vendor Name (text input)
- Vendor GSTIN (text input with GSTIN format validation)
- Invoice Number (text input)
- Invoice Date (date input)
- Total Amount (number input)
- CGST / SGST / IGST (number inputs)

Below form:
- GST flags summary (from gst_rules_json.flags)
- Notes textarea (optional reviewer comment)

Action buttons:
- "Approve As-Is" → POST /review/{id}/submit with action="APPROVED"
- "Save Edits & Approve" → POST with action="EDITED" and corrected_data
- "Reject" → POST with action="REJECTED"

On success: remove item from queue list, show success toast
On error: show error toast, keep modal open
```

---

## WEEK 3 — Infrastructure, Testing, and Polish

**Goal:** Add Docker setup, GitHub Actions CI/CD, comprehensive tests, image preprocessing, and production polish.

---

### STEP 3.1 — Image Preprocessing for Scanned Invoices

**What to do:** Add image preprocessing (deskew, denoise, contrast enhancement) that runs before sending scanned images to Azure AI. Improves OCR accuracy by 10–15% on bad scans.

**Files to create:**
- Create: `app/services/image_preprocessor.py`

**Agent Prompt:**
```
You are working on the InvoiceAI FastAPI backend (Python 3.11+).

Task: Create app/services/image_preprocessor.py

This module preprocesses invoice images before sending to Azure AI to improve OCR accuracy.

Add to requirements.txt: scikit-image==0.23.2, numpy==1.26.4

Functions to implement:

1. preprocess_invoice_image(file_bytes: bytes, filename: str) -> bytes:
   """
   Main entry point. Applies all preprocessing steps and returns improved image bytes.
   For PDFs: convert page 1 to high-res image, preprocess, return as JPEG bytes.
   For images: load, preprocess, return as JPEG bytes.
   Returns original bytes unchanged if preprocessing fails.
   """

2. _deskew_image(img_array: np.ndarray) -> np.ndarray:
   """
   Detects and corrects rotation using Hough transform.
   Only applies rotation correction if angle > 0.5 degrees.
   Max correction: ±15 degrees (avoid over-rotating).
   """

3. _denoise_image(img_array: np.ndarray) -> np.ndarray:
   """
   Apply mild Gaussian blur to reduce scan noise.
   sigma=0.5 — aggressive denoising hurts fine text.
   """

4. _enhance_contrast(img_array: np.ndarray) -> np.ndarray:
   """
   Convert to grayscale, apply CLAHE (Contrast Limited Adaptive Histogram Equalization).
   Convert back to BGR for OpenCV compatibility.
   """

5. _should_preprocess(filename: str) -> bool:
   """
   Returns True for image files (JPG, PNG, TIFF).
   Returns True for PDFs (will be converted to image).
   Returns False for anything else.
   """

Wire into process_invoice_task in invoices.py:
After QR detection fails, before calling analyze_invoice():
  preprocessed_bytes = preprocess_invoice_image(file_bytes, filename)
  file_url = upload_file_to_blob(preprocessed_bytes, filename)
  raw_fields = analyze_invoice(file_url)

Add PIL.Image, numpy, scikit-image imports with try/except fallback:
If preprocessing fails, log warning and use original bytes.
Never let preprocessing failure stop invoice processing.
```

---

### STEP 3.2 — Docker + Docker Compose Setup

**What to do:** Create a Dockerfile for the FastAPI backend and docker-compose.yml for local development with PostgreSQL and optional Redis.

**Files to create:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Agent Prompt:**
```
You are setting up Docker for the InvoiceAI FastAPI backend.

Task: Create production-ready Docker configuration.

Create Dockerfile (multi-stage build):

Stage 1 (builder):
FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

Stage 2 (production):
FROM python:3.11-slim
# Security: run as non-root
RUN groupadd -r appuser && useradd -r -g appuser appuser

# System dependencies for image processing (pyzbar, opencv)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libzbar0 libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /root/.local /home/appuser/.local
COPY . .
RUN chown -R appuser:appuser /app

USER appuser
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

Create docker-compose.yml for local development:
services:
  api:
    build: .
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./app:/app/app  # hot reload for dev
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: invoiceai
      POSTGRES_USER: invoiceai_admin
      POSTGRES_PASSWORD: localdevpassword
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U invoiceai_admin -d invoiceai"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:

Create .dockerignore:
__pycache__/
*.pyc
.env
venv/
.git/
frontend/node_modules/
*.md (except README)
docc/

Create scripts/init_db.sh:
#!/bin/bash
# Run this once after docker-compose up to initialize the database
docker-compose exec api alembic upgrade head
echo "Database initialized successfully"
```

**Definition of Done:**
- [ ] `docker-compose up` starts API + PostgreSQL
- [ ] API accessible at http://localhost:8000
- [ ] Health check endpoint returns `{"status": "ok", "db": "ok"}`
- [ ] No secrets in Dockerfile or docker-compose.yml
- [ ] Non-root user inside container

---

### STEP 3.3 — GitHub Actions CI/CD Pipeline

**What to do:** Create GitHub Actions workflows for: running tests on every PR, and deploying to Railway/Render on merge to main.

**Files to create:**
- Create: `.github/workflows/test.yml`
- Create: `.github/workflows/deploy.yml`

**Agent Prompt:**
```
You are setting up CI/CD for the InvoiceAI project.

Task: Create GitHub Actions workflows.

Create .github/workflows/test.yml:
name: Run Tests
on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [develop]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: invoiceai_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 5

    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: "3.11"
        cache: "pip"
    - run: pip install -r requirements.txt
    - run: pip install pytest pytest-asyncio httpx
    - name: Run tests
      env:
        DATABASE_URL: postgresql://test_user:test_password@localhost:5432/invoiceai_test
        JWT_SECRET: test-secret-key-for-ci-only
        AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: https://mock.cognitiveservices.azure.com/
        AZURE_DOCUMENT_INTELLIGENCE_KEY: mock_key
        AZURE_STORAGE_CONNECTION_STRING: DefaultEndpointsProtocol=https;AccountName=mock;AccountKey=mock==;EndpointSuffix=core.windows.net
        AZURE_STORAGE_CONTAINER_NAME: invoices-test
      run: pytest tests/ -v --tb=short

Create .github/workflows/deploy.yml:
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Deploy to Railway
      env:
        RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
      run: |
        npm install -g @railway/cli
        railway up --service invoiceai-api

Also create a Makefile for developer convenience:
test:
	pytest tests/ -v

run:
	uvicorn app.main:app --reload

migrate:
	alembic upgrade head

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down
```

---

### STEP 3.4 — Comprehensive Test Suite

**What to do:** Write pytest tests covering the full pipeline: auth, invoice upload, QR detection, confidence engine, GST rules, review queue, and webhooks.

**Files to create:**
- Create: `tests/conftest.py`
- Create: `tests/test_auth.py`
- Create: `tests/test_invoices.py`
- Create: `tests/test_confidence_engine.py`
- Create: `tests/test_gst_rules.py`
- Create: `tests/test_qr_detector.py`
- Create: `tests/sample_invoices/` (add sample test PDFs)

**Agent Prompt:**
```
You are writing tests for the InvoiceAI FastAPI backend.

Task: Create a comprehensive test suite using pytest and FastAPI TestClient.

Create tests/conftest.py:
- SQLite in-memory test database (DATABASE_URL = "sqlite:///./test.db")
- Override get_db dependency with test session
- Fixtures: test_client, test_user, auth_headers (JWT for test_user)
- Auto-create all tables before each test, drop after
- Mock Azure services (patch azure_ai.analyze_invoice and blob_storage.upload_file_to_blob)

Create tests/test_auth.py:
- test_register_success: POST /auth/register → 201, returns id + email
- test_register_duplicate_email: second register → 400
- test_login_success: POST /auth/login → 200, returns access_token
- test_login_wrong_password: → 401
- test_get_me: GET /auth/me with valid JWT → 200, returns user
- test_get_me_no_token: → 401

Create tests/test_invoices.py:
- test_upload_success: Upload valid PDF → 202, returns id and status="processing"
- test_upload_invalid_type: Upload .exe → 400
- test_upload_too_large: Upload >20MB → 413
- test_get_invoice_not_found: GET /invoices/fake-id → 404
- test_get_invoice_wrong_user: Invoice from user A not visible to user B
- test_list_invoices: Returns paginated results
- test_delete_invoice: 204 on success
- test_export_csv: GET /invoices/export/csv → 200, Content-Type text/csv
- test_idempotency: Same key twice → same invoice_id

Create tests/test_confidence_engine.py:
- test_empty_data: compute_confidence({}) → score=0.0, status="HUMAN_REQUIRED"
- test_high_confidence: All fields with confidence 0.95 → status="AUTO_APPROVED"
- test_medium_confidence: Mix of 0.70-0.85 → status="NEEDS_REVIEW"
- test_low_confidence: All fields 0.40 → status="HUMAN_REQUIRED"
- test_null_values_reduce_score: Fields with value=None count as 0.0 confidence

Create tests/test_gst_rules.py:
- test_valid_gstin: "29ABCDE1234F1Z5" → valid
- test_invalid_gstin_length: "29ABCDE1234F1Z" (14 chars) → invalid
- test_invalid_gstin_checksum: Modify last char → invalid
- test_math_correct: cgst=sgst=4500, total_tax=9000 → passes
- test_math_wrong: cgst≠sgst → fails
- test_date_valid: today - 30 days → valid
- test_date_future: tomorrow → invalid
- test_date_too_old: today - 200 days → invalid

Create tests/test_qr_detector.py (using mock):
- test_detect_qr_returns_none_for_plain_pdf: Mock pdf with no QR → returns None
- test_parse_gst_jwt: Given mock GST JWT string → returns dict with SellerGstin etc.
- test_handles_invalid_file_gracefully: Pass garbage bytes → returns None (no exception)

All tests must be independent — no shared state between tests.
Use pytest fixtures for everything. No global mutable state.
```

---

### STEP 3.5 — Backend API Polish and Security Hardening

**What to do:** Add all security headers, improve error responses, add request validation, update the health endpoint, and ensure all edge cases are handled.

**Agent Prompt:**
```
You are hardening the InvoiceAI FastAPI backend for production.

Task: Security and API polish.

PART A — Security headers middleware in app/main.py:
Add a custom middleware that sets these headers on every response:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

PART B — Improve health endpoint:
GET /health should return:
{
  "status": "ok" or "degraded",
  "version": "1.0.0",
  "db": "ok" or "error: <reason>",
  "azure_ai": "configured" or "not_configured",
  "timestamp": "ISO-8601 UTC timestamp"
}

PART C — Global exception handler:
Add to main.py:
- Handler for RequestValidationError → 422 with clean field-level error messages
- Handler for SQLAlchemyError → 500 with "Database error" (no internal details leaked)
- Handler for unhandled Exception → 500 with correlation_id in response

PART D — File validation improvements in invoices.py:
- Check actual file magic bytes (first 4-8 bytes), not just extension
  - PDF: starts with %PDF
  - JPEG: starts with FF D8 FF
  - PNG: starts with 89 50 4E 47
- If magic bytes don't match claimed extension → 400 "File content does not match extension"

PART E — Improve config.py with validation:
Add validators to Settings:
- AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT must start with "https://"
- JWT_SECRET must be at least 32 characters
- DATABASE_URL must start with "postgresql://" or "sqlite:///"
Use Pydantic field validators.

PART F — Add API versioning prefix:
Change all router prefixes to include /api/v1:
- /api/v1/auth/...
- /api/v1/invoices/...
- /api/v1/review/...
- /api/v1/webhooks/...
Keep /health and /docs at root level.
Update CORS to reflect new paths.
```

---

### STEP 3.6 — Frontend Polish and Wiring

**What to do:** Final frontend work: wire review queue to backend, add settings page, improve error states, ensure mobile responsiveness, and deploy.

**Agent Prompt:**
```
You are finalizing the InvoiceAI React frontend.

Task: Complete frontend wiring and polish.

PART A — Wire all API functions in src/api/invoices.ts:
Implement typed functions for every endpoint:
- uploadInvoice(file: File): Promise<{id: string, status: string}>
- getInvoice(id: string): Promise<Invoice>
- listInvoices(page: number, status?: string): Promise<{items: InvoiceListItem[], total: number}>
- deleteInvoice(id: string): Promise<void>
- exportCSV(): Promise<Blob>
- exportXLSX(): Promise<Blob>
- getStats(): Promise<Stats>
- getReviewQueue(page: number): Promise<{items: ReviewItem[], total: number}>
- submitReview(invoiceId: string, payload: ReviewSubmit): Promise<Invoice>
- getWebhooks(): Promise<WebhookConfig[]>
- createWebhook(url: string, events: string[]): Promise<WebhookConfig>
- deleteWebhook(id: string): Promise<void>

PART B — Create src/pages/SettingsPage.tsx:
- Section 1: "My Account" — shows email, api_key (copy button)
- Section 2: "Webhooks" — list webhooks, add new webhook (url + events checkboxes), delete
- Section 3: "Export Data" — "Export as CSV" and "Export as Excel" buttons
  - On click: download file using URL.createObjectURL(blob)

PART C — Loading states:
- Add <Skeleton> components from shadcn for every data-fetching state
- Dashboard stats: 4 skeleton cards while loading
- Invoice list: 10 skeleton rows while loading
- Invoice detail: skeleton on left + right panels while loading

PART D — Error states:
- Network error (API unreachable): full-page error card with "Retry" button
- 404 invoice: friendly "Invoice not found" page with "Back to list" link
- Empty states: custom illustrations (use SVG inline) for empty invoice list and empty review queue

PART E — Mobile responsiveness:
- Invoice list: on mobile (<640px), show card view instead of table
- Invoice detail: stacked layout (original on top, data below)
- Review modal: full-screen on mobile
- Sidebar: collapsible on tablet, bottom nav on mobile

PART F — Demo preparation:
Create src/components/DemoMode.tsx:
- "Try Demo" button on login page
- Uses hardcoded demo credentials
- Shows sample processed invoices in the dashboard
- Add "DEMO" banner in header during demo mode
```

---

### STEP 3.7 — Final Integration + Deployment Checklist

**What to do:** Final end-to-end testing, production environment setup, and demo preparation.

**Agent Prompt:**
```
You are finalizing the InvoiceAI deployment.

Task: Production deployment and demo preparation.

PART A — Environment setup (.env.example):
Create .env.example with all required variables and documentation:

# === AZURE SERVICES ===
# Get from Azure Portal → AI Document Intelligence → Keys and Endpoint
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your_key_here

# Get from Azure Portal → Storage Account → Access Keys
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
AZURE_STORAGE_CONTAINER_NAME=invoices-test

# === DATABASE ===
# Format: postgresql://user:password@host:5432/dbname
DATABASE_URL=postgresql://invoiceai_admin:password@localhost:5432/invoiceai

# === AUTH ===
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET=generate_a_secure_random_32_character_secret_here

# === OPTIONAL ===
ENVIRONMENT=dev  # or "prod"
LOG_LEVEL=INFO

PART B — Create README.md with complete setup guide:
## Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL 14+
- Azure account (free tier works for testing)

### 1. Clone and setup
```bash
git clone https://github.com/your-org/invoiceai-backend
cd invoiceai-backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your Azure credentials
```

### 3. Initialize database
```bash
alembic upgrade head
```

### 4. Run
```bash
uvicorn app.main:app --reload
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

### 5. Docker (alternative)
```bash
docker-compose up
```

PART C — Demo data script:
Create scripts/seed_demo_data.py:
- Creates a demo user: demo@invoiceai.in / Demo@2026
- Creates 5 sample invoice records with mock data_json
- One AUTO_APPROVED, one NEEDS_REVIEW, one HUMAN_REQUIRED, one processing, one failed
- Run with: python scripts/seed_demo_data.py

PART D — Production checklist (create DEPLOYMENT.md):
Pre-deployment:
[ ] All tests passing (pytest tests/ -v)
[ ] .env NOT committed to git (check: git ls-files .env)
[ ] CORS origins updated to production domain
[ ] JWT_SECRET is 64+ char random string
[ ] ENVIRONMENT=prod set
[ ] Database migrations applied (alembic upgrade head)

Post-deployment:
[ ] GET /health returns {"status": "ok", "db": "ok"}
[ ] GET /docs returns Swagger UI
[ ] POST /api/v1/auth/register works
[ ] POST /api/v1/invoices/upload works with a test PDF
[ ] Invoice processes successfully end-to-end
```

---

## SUMMARY: COMPLETE TASK LIST WITH EFFORT ESTIMATES

| Step | Task | Owner | Effort | Week |
|------|------|-------|--------|------|
| 1.1 | QR Detection Module | Dev 2 | 4h | W1 |
| 1.2 | Confidence Engine | Dev 2 | 3h | W1 |
| 1.3 | GST Rules Engine | Dev 2 | 5h | W1 |
| 1.4 | Pipeline Refactor + Idempotency | Dev 1 | 6h | W1 |
| 1.5 | Human Review Queue API | Dev 1 | 5h | W1 |
| 1.6 | Webhook Delivery System | Dev 1 | 5h | W1 |
| 1.7 | Export + Rate Limiting | Dev 1 | 3h | W1 |
| 2.1 | React Project Setup | Dev 3 | 3h | W2 |
| 2.2 | Auth Pages (Login/Register) | Dev 3 | 4h | W2 |
| 2.3 | Dashboard Layout + Navigation | Dev 3 | 4h | W2 |
| 2.4 | Upload Page + Dropzone + Polling | Dev 3 | 5h | W2 |
| 2.5 | Invoice Detail Page | Dev 3 | 6h | W2 |
| 2.6 | Invoice List + Dashboard Stats | Dev 3 | 4h | W2 |
| 2.7 | Review Queue Page | Dev 3 | 4h | W2 |
| 3.1 | Image Preprocessing | Dev 2 | 4h | W3 |
| 3.2 | Docker + Docker Compose | Dev 4 | 3h | W3 |
| 3.3 | GitHub Actions CI/CD | Dev 4 | 3h | W3 |
| 3.4 | Test Suite | Dev 1 | 6h | W3 |
| 3.5 | Security Hardening | Dev 1 | 4h | W3 |
| 3.6 | Frontend Polish + Wiring | Dev 3 | 5h | W3 |
| 3.7 | Final Integration + Deployment | All | 4h | W3 |

**Total effort: ~96 developer-hours across 3 weeks**

---

## DEPENDENCY MAP

```
Step 1.1 (QR) ─────┐
Step 1.2 (Confidence) ─┤
Step 1.3 (GST Rules) ──┤──→ Step 1.4 (Pipeline) ──→ Step 1.5 (Review API)
                       │                          └──→ Step 1.6 (Webhooks)
                       └──→ Step 3.1 (Preprocessing)

Step 2.1 (Setup) → Step 2.2 (Auth) → Step 2.3 (Layout) → Steps 2.4-2.7

Step 1.4 must be done before Step 2.4 (upload polling needs final status values)
Step 1.5 must be done before Step 2.7 (review queue needs backend API)

Step 3.2 (Docker) → Step 3.3 (CI/CD) → Step 3.7 (Deployment)
Step 3.4 (Tests) → Step 3.3 (CI runs tests)
```

---

## INDUSTRY-GRADE CHECKLIST

Before calling the MVP complete, verify every item:

### Security
- [ ] No secrets in any code file or git history
- [ ] JWT secret >= 64 characters in production
- [ ] All passwords hashed with bcrypt
- [ ] File magic bytes validated (not just extension)
- [ ] HMAC-SHA256 on webhook payloads
- [ ] SQL injection impossible (SQLAlchemy ORM, no raw queries)
- [ ] Rate limiting on upload endpoint
- [ ] Security headers on all responses

### Data Quality
- [ ] Every invoice has confidence_score, status, source_type, ingestion_method
- [ ] GST rules run on every OCR-processed invoice
- [ ] QR invoices get confidence = 1.0, status = AUTO_APPROVED
- [ ] Idempotency prevents duplicate processing

### Reliability
- [ ] Background task failures don't crash the API
- [ ] Azure AI timeout handled gracefully (invoice status → HUMAN_REQUIRED)
- [ ] Blob upload failure handled (invoice status → failed with error_detail)
- [ ] Database connection failure → health endpoint reports "degraded"
- [ ] Webhook delivery retries 3 times with exponential backoff

### Observability
- [ ] Structured logging with invoice_id on every log line
- [ ] Processing time tracked (processing_time_ms column)
- [ ] `GET /health` reports DB status
- [ ] `GET /api/v1/invoices/stats` gives real-time accuracy metrics

### User Experience
- [ ] Status polling stops when invoice reaches final state
- [ ] Uploading invalid file type shows clear error (not generic)
- [ ] Review queue sorted by priority (HUMAN_REQUIRED before NEEDS_REVIEW)
- [ ] Export downloads work (CSV + XLSX)
- [ ] Mobile-responsive on 375px viewport

### Documentation
- [ ] README has working quick-start guide
- [ ] .env.example has all required variables with comments
- [ ] FastAPI /docs has descriptions on all endpoints
- [ ] DEPLOYMENT.md covers production checklist
