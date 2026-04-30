# InvoiceAI — Complete Fix Manifest
# Port 8000 → 8001 + All Bugs Resolved

## Root cause of port conflict
Django AI Trainer owns port 8000.
InvoiceAI FastAPI now runs on port **8001**.
Every file that hardcoded 8000 is patched here.

## Files changed
- app/config.py           — add APP_PORT setting
- app/main.py             — CORS: drop 8000, add 8001; use APP_PORT
- .env.example            — document APP_PORT
- invoiceai-frontend/.env.local     — VITE_API_URL → 8001 (CREATE THIS)
- invoiceai-frontend/vite.config.ts — add dev proxy
- invoiceai-frontend/src/api/client.ts       — fallback 8001
- invoiceai-frontend/src/utils/url.ts        — NEW: centralised API base URL
- invoiceai-frontend/src/pages/InvoiceDetailPage.tsx — fix hardcoded 8000
- invoiceai-frontend/src/components/ReviewModal.tsx  — fix hardcoded 8000
- invoiceai-frontend/tailwind.config.js      — fix empty content []
- invoiceai-frontend/src/index.css           — replace Vite template with Tailwind reset
- invoiceai-frontend/src/components/GSTRulesPanel.tsx — fix wrong key names
- invoiceai-frontend/src/store/authStore.ts  — add JWT expiry check
- frontend/assets/js/app.js                 — fix legacy port check (8000→8001)
