# InvoiceAI — Enterprise Invoice Processing Platform

InvoiceAI is a full-stack application for automated extraction, processing, and management of Indian GST invoices. It uses **Azure Document Intelligence** for high-accuracy OCR and **Azure Blob Storage** for secure document archiving.

---

## ⚠️ Port Configuration

InvoiceAI FastAPI backend runs on **port 8001**.

> **Why not 8000?** Port 8000 is reserved for the Django AI Trainer service running on the same machine. Using 8001 avoids any conflict. Do **not** change this without also changing the Django service port.

---

## 🌟 Key Features

- **QR Detection**: GST e-Invoice QR codes are decoded directly — 100% accuracy, zero AI cost.
- **Azure AI OCR**: Fallback extraction using Azure Document Intelligence prebuilt invoice model.
- **Confidence Routing**: AUTO_APPROVED (≥90%) / NEEDS_REVIEW (60–89%) / HUMAN_REQUIRED (<60%).
- **GST Rules Engine**: GSTIN checksum, CGST/SGST vs IGST math, HSN codes, date validation, place of supply.
- **Human Review Queue**: Side-by-side document viewer + editable form + immutable audit log.
- **Webhook Delivery**: HMAC-SHA256 signed POST to registered endpoints on invoice completion.
- **Export**: CSV and XLSX download of all processed invoices.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+ (for React frontend)
- An active Azure subscription (Document Intelligence + Blob Storage)

### 1. Clone
```bash
git clone https://github.com/Patil-Sumit98/Redivivus-invoiceai.git
cd Redivivus-invoiceai
```

### 2. Backend setup
```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Create `.env`
```bash
cp .env.example .env
# Edit .env — fill in your Azure keys and JWT_SECRET
```

Minimum required fields in `.env`:
```env
APP_PORT=8001
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your_key_here
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
AZURE_STORAGE_CONTAINER_NAME=invoices-test
DATABASE_URL=sqlite:///./invoiceai.db
JWT_SECRET=<run: python -c "import secrets; print(secrets.token_hex(32))">
```

### 4. Initialize database
```bash
alembic upgrade head
```

### 5. Start backend (port 8001)
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

Verify:
```bash
curl http://localhost:8001/health
# → {"status":"ok","port":8001,"db":"ok",...}
```

API docs: http://localhost:8001/docs

### 6. Start React frontend
```bash
cd invoiceai-frontend
npm install
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies all API calls to `localhost:8001` automatically.

### 7. Access the platform

| Interface | URL |
|-----------|-----|
| React Dashboard | http://localhost:5173 |
| API Docs (Swagger) | http://localhost:8001/docs |
| Legacy HTML frontend | http://localhost:8001/frontend |

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, FastAPI, SQLAlchemy, Alembic |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| AI/OCR | Azure AI Document Intelligence |
| Storage | Azure Blob Storage |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Database | SQLite (dev) / PostgreSQL (prod) |

---

## 📁 Project Structure

```
Redivivus-invoiceai/
├── app/
│   ├── config.py          # Settings (APP_PORT, Azure, JWT)
│   ├── main.py            # FastAPI app, CORS, health check
│   ├── database.py        # SQLAlchemy engine
│   ├── middleware/        # JWT auth, rate limiting
│   ├── models/            # Invoice, User, ReviewLog, Webhook
│   ├── routers/           # auth, invoices, review, webhooks
│   ├── schemas/           # Pydantic request/response schemas
│   └── services/          # azure_ai, blob_storage, qr_detector,
│                          #   confidence_engine, gst_rules,
│                          #   invoice_mapper, webhook_service
├── invoiceai-frontend/    # React 18 + TypeScript SPA
│   ├── src/
│   │   ├── api/           # Axios client (baseURL → 8001)
│   │   ├── components/    # UI components + shadcn stubs
│   │   ├── hooks/         # React Query hooks
│   │   ├── pages/         # Dashboard, Upload, Invoices, Review, Settings
│   │   ├── store/         # Zustand auth store
│   │   └── utils/         # formatters, url (resolveFileUrl)
│   ├── .env.local         # VITE_API_URL=http://localhost:8001
│   └── vite.config.ts     # Proxy → 8001
├── frontend/              # Legacy vanilla JS frontend
│   └── assets/js/app.js   # BASE points to 8001
├── alembic/               # Database migrations
├── .env.example           # Template with APP_PORT documented
└── requirements.txt
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Address already in use` on port 8001 | Another process owns 8001 | Change `APP_PORT=8002` in `.env` and update `VITE_API_URL` |
| Django AI Trainer unreachable | You accidentally started InvoiceAI on 8000 | Always use `--port 8001` |
| `ValidationError` on startup | `.env` file missing or incomplete | `cp .env.example .env` then fill in values |
| UI renders completely unstyled | `tailwind.config.js` had empty content array | Already fixed in v2 — pull latest |
| GST tab shows "N/A" for all rules | Key name mismatch in GSTRulesPanel | Already fixed in v2 — pull latest |
| Document viewer shows broken image | Hardcoded `localhost:8000` in components | Already fixed in v2 — pull latest |
