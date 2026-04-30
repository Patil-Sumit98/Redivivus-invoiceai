# InvoiceAI — Port Conflict Fix + Bug Patches
## Complete Apply Guide

---

## WHAT WAS WRONG

| Problem | Root Cause |
|---------|-----------|
| FastAPI wouldn't start | Django AI Trainer already owns port 8000 |
| No .env file | Was cancelled — app crashed on import |
| UI completely unstyled in prod | `tailwind.config.js` had `content: []` |
| All text center-aligned | `index.css` was Vite template (set `text-align: center` on `#root`) |
| GST Validation tab always shows "N/A" | GSTRulesPanel used wrong key names AND got wrong object |
| Ingestion method badge always shows "Azure AI" | Read from `data.metadata.ingestion_method` (doesn't exist) |
| Document viewer showed broken image | `localhost:8000` hardcoded in 2 components |
| Expired tokens not caught on reload | `initFromStorage` didn't check JWT `exp` claim |
| GSTIN validation always fails in review modal | Input not auto-uppercased |
| Review modal polled every 2s | Used polling hook that wasn't disabled |

---

## STEP 1 — Create `.env` file

From the project root (`Redivivus-invoiceai/`):

```bash
cp .env.example .env
```

Then open `.env` and fill in your values. **Critical fields:**

```env
# Must be 8001 — Django AI Trainer owns 8000
APP_PORT=8001

# Azure (get from Azure Portal)
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your_key_here
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_STORAGE_CONTAINER_NAME=invoices-test

# Database (SQLite for local dev)
DATABASE_URL=sqlite:///./invoiceai.db

# Generate: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET=your_64_char_secret_here
```

---

## STEP 2 — Apply backend patches

Copy these files into the project (overwrite existing):

```
fixes/app/config.py   → app/config.py
fixes/app/main.py     → app/main.py
fixes/.env.example    → .env.example
```

---

## STEP 3 — Apply frontend patches

```
fixes/frontend_config/.env.local       → invoiceai-frontend/.env.local    (CREATE)
fixes/frontend_config/vite.config.ts   → invoiceai-frontend/vite.config.ts
fixes/frontend_config/tailwind.config.js → invoiceai-frontend/tailwind.config.js
fixes/frontend_config/index.css        → invoiceai-frontend/src/index.css

fixes/frontend_src/api/client.ts       → invoiceai-frontend/src/api/client.ts
fixes/frontend_src/utils/url.ts        → invoiceai-frontend/src/utils/url.ts  (NEW FILE)
fixes/frontend_src/store/authStore.ts  → invoiceai-frontend/src/store/authStore.ts
fixes/frontend_src/pages/InvoiceDetailPage.tsx → invoiceai-frontend/src/pages/InvoiceDetailPage.tsx
fixes/frontend_src/components/ReviewModal.tsx  → invoiceai-frontend/src/components/ReviewModal.tsx
fixes/frontend_src/components/GSTRulesPanel.tsx → invoiceai-frontend/src/components/GSTRulesPanel.tsx
```

**Also delete `App.css`** (Vite template leftovers — not used by the app):
```bash
rm invoiceai-frontend/src/App.css
```

**Also patch `frontend/assets/js/app.js` line 6** (legacy HTML frontend):
```js
// Change:
const BASE = window.location.port === '8000' ? '' : 'http://127.0.0.1:8000';
// To:
const BASE = window.location.port === '8001' ? '' : 'http://127.0.0.1:8001';
```

---

## STEP 4 — Initialize the database

```bash
# From project root, with your venv active:
alembic upgrade head
```

---

## STEP 5 — Start InvoiceAI backend (port 8001)

```bash
# From project root:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

Verify it started:
```bash
curl http://localhost:8001/health
# Expected: {"status":"ok","port":8001,"db":"ok",...}
```

Django AI Trainer stays on 8000 — no conflict.

---

## STEP 6 — Start React frontend

```bash
cd invoiceai-frontend
npm install          # if not done yet
npm run dev          # runs on localhost:5173, proxies API to 8001
```

Open: http://localhost:5173

---

## QUICK COPY-PASTE (bash — run from project root)

```bash
# Assuming you cloned the repo and fixes/ folder is at project root
cp fixes/app/config.py app/config.py
cp fixes/app/main.py app/main.py
cp fixes/.env.example .env.example

cp fixes/frontend_config/.env.local invoiceai-frontend/.env.local
cp fixes/frontend_config/vite.config.ts invoiceai-frontend/vite.config.ts
cp fixes/frontend_config/tailwind.config.js invoiceai-frontend/tailwind.config.js
cp fixes/frontend_config/index.css invoiceai-frontend/src/index.css

cp fixes/frontend_src/api/client.ts invoiceai-frontend/src/api/client.ts
cp fixes/frontend_src/utils/url.ts invoiceai-frontend/src/utils/url.ts
cp fixes/frontend_src/store/authStore.ts invoiceai-frontend/src/store/authStore.ts
cp fixes/frontend_src/pages/InvoiceDetailPage.tsx invoiceai-frontend/src/pages/InvoiceDetailPage.tsx
cp fixes/frontend_src/components/ReviewModal.tsx invoiceai-frontend/src/components/ReviewModal.tsx
cp fixes/frontend_src/components/GSTRulesPanel.tsx invoiceai-frontend/src/components/GSTRulesPanel.tsx

rm -f invoiceai-frontend/src/App.css

# Patch legacy JS frontend
sed -i "s/port === '8000'/port === '8001'/g; s/127.0.0.1:8000/127.0.0.1:8001/g" frontend/assets/js/app.js

# Edit .env with your Azure keys
cp .env.example .env
echo "Now edit .env and fill in your Azure keys + JWT_SECRET"
```

---

## WHAT EACH FIX DID

### Backend

**`app/config.py`** — Added `APP_PORT: int = 8001` and `APP_HOST` settings.
Use in startup: `uvicorn app.main:app --host 0.0.0.0 --port 8001`

**`app/main.py`** — CORS list removed `localhost:8000`, added `localhost:8001`.
Also fixed the generic Exception handler (was catching HTTPException before FastAPI could handle it → all 404s returned 500 errors).

### Frontend — Port

**`invoiceai-frontend/.env.local`** (NEW) — `VITE_API_URL=http://localhost:8001`

**`invoiceai-frontend/vite.config.ts`** — Added `server.proxy` that forwards all
`/auth`, `/invoices`, `/review`, `/webhooks`, `/health` calls to `localhost:8001`.
This means even without `.env.local`, the Vite dev server routes correctly.

**`invoiceai-frontend/src/api/client.ts`** — Fallback changed from `localhost:8000` → `localhost:8001`.

**`invoiceai-frontend/src/utils/url.ts`** (NEW) — `resolveFileUrl()` helper that constructs
absolute file URLs using `VITE_API_URL` instead of hardcoded `localhost:8000`.

**`invoiceai-frontend/src/pages/InvoiceDetailPage.tsx`** — Replaced hardcoded
`http://localhost:8000` with `resolveFileUrl(invoice.file_url)`.

**`invoiceai-frontend/src/components/ReviewModal.tsx`** — Same file URL fix.
Also disabled the polling interval (was polling every 2s unnecessarily inside the modal).
Also fixed GSTIN auto-uppercase on input change.

**`frontend/assets/js/app.js`** — Legacy HTML frontend port check updated.

### Frontend — Bugs

**`invoiceai-frontend/tailwind.config.js`** — `content: []` → `content: ["./index.html", "./src/**/*.{ts,tsx}"]`.
This was the #1 show-stopper: ALL Tailwind classes were purged in production.

**`invoiceai-frontend/src/index.css`** — Replaced the entire Vite starter template
with proper Tailwind directives + clean reset. The old file had `text-align: center`
on `#root` which center-aligned every label, table cell, and paragraph in the dashboard.

**`invoiceai-frontend/src/components/GSTRulesPanel.tsx`** — Fixed two bugs simultaneously:
1. Key names: now uses `format`, `checksum`, `tax_math`, `line_items_math`, `date`, `place_of_supply`
   (was looking for `gstin_format_valid`, etc. which don't exist in the backend response).
2. Prop signature: now accepts `gstData` (the full `{passed, rules, flags}` object) and reads
   `.rules` internally. Previously it received the full object but read it as if it were `.rules`.

**`invoiceai-frontend/src/store/authStore.ts`** — Added JWT expiry check in `initFromStorage()`.
Previously, a 24-hour-old expired token set `isAuthenticated: true`, causing every API
call on page refresh to immediately 401 and bounce the user to login mid-session.

---

## REMAINING KNOWN ISSUES (not breaking — fix when time allows)

| Issue | File | Severity |
|-------|------|----------|
| All UI components are stub `<div>` wrappers — shadcn/ui not installed | `src/components/ui/*.tsx` | Medium — styling is Tailwind-class-only but functional |
| `useInvoiceList(1000)` fetches all invoices at once | `useInvoiceList.ts` | Medium — slow on large datasets |
| Webhook URLs not SSRF-validated | `webhook_service.py` | High security |
| `RATE_LIMIT_STORE` grows unboundedly | `rate_limit.py` | Low (dev) / Medium (prod) |
| `window.confirm()` for delete | `InvoicesPage.tsx` | Low UX |
| `DeliveryWebhookSync` creates new DB session per retry loop | `webhook_service.py` | Medium — connection leak |
| `DocumentIntelligenceClient` created per AI call | `azure_ai.py` | Low — slight latency |
