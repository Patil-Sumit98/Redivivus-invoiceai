'use strict';

/* ───────────────────────────────────────────
   CONFIG
─────────────────────────────────────────── */
const BASE = window.location.port === '8001' ? '' : 'http://127.0.0.1:8001';
let authToken  = localStorage.getItem('iai_token') || null;
let activeUser = null;
let pollMap    = {};   // {key: intervalId}
let currentPage = 'dashboard';

/* ───────────────────────────────────────────
   API CLIENT
─────────────────────────────────────────── */
async function request(method, path, body = null, isFormData = false) {
  const headers = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const config = { method, headers };
  if (body) config.body = isFormData ? body : JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${BASE}${path}`, config);
  } catch (_) {
    throw new Error('Cannot reach the backend. Is the server running on localhost:8000?');
  }

  if (res.status === 401) { logout(); throw new Error('Session expired. Please sign in again.'); }

  let data;
  try { data = await res.json(); } catch (_) { data = {}; }

  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

/* ───────────────────────────────────────────
   API STATUS CHECK
─────────────────────────────────────────── */
async function checkApiStatus() {
  const dot = document.getElementById('api-dot');
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2500) });
    dot.classList.toggle('online', r.ok);
  } catch (_) {
    dot.classList.remove('online');
  }
}
checkApiStatus();
setInterval(checkApiStatus, 15000);

/* ───────────────────────────────────────────
   AUTH
─────────────────────────────────────────── */
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('form-login').classList.toggle('visible', tab === 'login');
  document.getElementById('form-register').classList.toggle('visible', tab === 'register');
}

function setAuthError(formId, msg) {
  const el = document.getElementById(formId + '-error');
  el.innerHTML = msg
    ? `<div class="alert alert-error"><span class="alert-icon">⚠</span>${escHtml(msg)}</div>`
    : '';
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  setAuthError('login', '');

  if (!email || !pass) { setAuthError('login', 'Please enter your email and password.'); return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in…';

  try {
    const data = await request('POST', '/auth/login', { email, password: pass });
    authToken = data.access_token;
    localStorage.setItem('iai_token', authToken);
    activeUser = { email };
    onAuthenticated();
  } catch (e) {
    setAuthError('login', e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function doRegister() {
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  setAuthError('register', '');

  if (!email || !pass) { setAuthError('register', 'Please fill in all fields.'); return; }
  if (pass.length < 6)  { setAuthError('register', 'Password must be at least 6 characters.'); return; }

  const btn = document.getElementById('reg-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating account…';

  try {
    await request('POST', '/auth/register', { email, password: pass });
    const data = await request('POST', '/auth/login', { email, password: pass });
    authToken = data.access_token;
    localStorage.setItem('iai_token', authToken);
    activeUser = { email };
    onAuthenticated();
    showToast('Account created successfully', 'success');
  } catch (e) {
    setAuthError('register', e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

function onAuthenticated() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('shell').style.display = 'flex';
  const initials = (activeUser.email || '?').slice(0, 2).toUpperCase();
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('user-name-display').textContent = activeUser.email.split('@')[0];
  go('dashboard');
}

function logout() {
  authToken = null;
  activeUser = null;
  localStorage.removeItem('iai_token');
  clearAllPolls();
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('shell').style.display = 'none';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
  setAuthError('login', '');
}

function doLogout() {
  logout();
  showToast('Signed out', 'info');
}

async function doDeleteInvoice(id) {
  if (!confirm('Are you sure you want to permanently delete this invoice? This action cannot be undone.')) return;
  try {
    await request('DELETE', `/invoices/${id}`);
    showToast('Invoice deleted', 'success');
    if (currentPage === 'detail') go('invoices');
    else if (currentPage === 'invoices') renderInvoices(document.getElementById('page-content'));
    else if (currentPage === 'dashboard') renderDashboard(document.getElementById('page-content'));
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function doReprocessInvoice(id) {
  try {
    await request('POST', `/invoices/${id}/reprocess`);
    showToast('Reprocessing started…', 'info');
    if (currentPage === 'detail') loadDetail(id);
    else if (currentPage === 'invoices') renderInvoices(document.getElementById('page-content'));
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// Auto-restore session on load
window.addEventListener('DOMContentLoaded', async () => {
  // Enter key on auth inputs
  ['login-email','login-pass'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });
  ['reg-email','reg-pass'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
  });

  if (authToken) {
    try {
      activeUser = await request('GET', '/auth/me');
      onAuthenticated();
    } catch (_) {
      authToken = null;
      localStorage.removeItem('iai_token');
    }
  }
});

/* ───────────────────────────────────────────
   ROUTER
─────────────────────────────────────────── */
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  upload:    'Upload Invoice',
  invoices:  'All Invoices',
  detail:    'Invoice Detail',
};

function go(page, param = null) {
  clearAllPolls();
  currentPage = page;

  // Update sidebar
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  // Topbar
  document.getElementById('topbar-page').textContent = PAGE_TITLES[page] || page;
  const sep   = document.getElementById('topbar-sep');
  const crumb = document.getElementById('topbar-crumb');
  if (param) {
    sep.style.display = 'inline'; crumb.style.display = 'inline';
    crumb.textContent = param.slice(0, 8) + '…';
  } else {
    sep.style.display = 'none'; crumb.style.display = 'none';
  }

  const content = document.getElementById('page-content');
  content.scrollTop = 0;

  switch (page) {
    case 'dashboard': renderDashboard(content); break;
    case 'upload':    renderUpload(content);    break;
    case 'invoices':  renderInvoices(content);  break;
    case 'detail':    renderDetail(content, param); break;
  }
}

/* ───────────────────────────────────────────
   POLL MANAGEMENT
─────────────────────────────────────────── */
function poll(key, fn, interval = 3000) {
  clearPoll(key);
  pollMap[key] = setInterval(fn, interval);
}
function clearPoll(key) {
  if (pollMap[key]) { clearInterval(pollMap[key]); delete pollMap[key]; }
}
function clearAllPolls() {
  Object.keys(pollMap).forEach(k => { clearInterval(pollMap[k]); });
  pollMap = {};
}

/* ───────────────────────────────────────────
   PAGE: DASHBOARD
─────────────────────────────────────────── */
async function renderDashboard(el) {
  el.innerHTML = `
    <div class="page-heading">
      <div class="page-title">Overview</div>
      <div class="page-desc">Your invoice processing summary and recent activity</div>
    </div>
    <div class="stats-grid" id="stats-grid">
      ${[0,1,2,3].map(() => `
        <div class="stat-card">
          <div class="skel" style="height:10px;width:55%;margin-bottom:14px"></div>
          <div class="skel" style="height:30px;width:40%"></div>
        </div>`).join('')}
    </div>
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">Recent Invoices</span>
        <button class="btn btn-secondary btn-sm" onclick="go('upload')">Upload new</button>
      </div>
      <div id="recent-invoices">
        <div style="padding:28px;display:flex;justify-content:center"><span class="spinner spinner-lg"></span></div>
      </div>
    </div>`;

  try {
    const [stats, invData] = await Promise.all([
      request('GET', '/invoices/stats').catch(() => null),
      request('GET', '/invoices/?limit=8')
    ]);

    const items = invData.items || [];
    const total = invData.total ?? items.length;

    // Stats cards — use stats endpoint if available, else derive from list
    const completed  = stats?.completed  ?? items.filter(i => i.status === 'completed').length;
    const processing = stats?.processing ?? items.filter(i => i.status === 'processing').length;
    const avgConf    = stats?.avg_confidence ?? null;

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Invoices</div>
        <div class="stat-value">${total}</div>
        <div class="stat-sub">All time</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Completed</div>
        <div class="stat-value green">${completed}</div>
        <div class="stat-sub">Successfully extracted</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">In Progress</div>
        <div class="stat-value amber">${processing}</div>
        <div class="stat-sub">Being processed now</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Confidence</div>
        <div class="stat-value blue">${avgConf != null ? (avgConf * 100).toFixed(0) + '%' : '—'}</div>
        <div class="stat-sub">AI extraction quality</div>
      </div>`;

    renderInvoiceRows('recent-invoices', items, true);

    // Poll if any processing
    if (processing > 0) {
      poll('dash', async () => {
        const fresh = await request('GET', '/invoices/?limit=8').catch(() => null);
        if (!fresh) return;
        renderInvoiceRows('recent-invoices', fresh.items || [], true);
        if (!fresh.items.some(i => i.status === 'processing')) clearPoll('dash');
      });
    }

  } catch (e) {
    el.innerHTML += `<div class="alert alert-error" style="margin-top:12px"><span class="alert-icon">⚠</span>${escHtml(e.message)}</div>`;
  }
}

/* ───────────────────────────────────────────
   PAGE: UPLOAD
─────────────────────────────────────────── */
function renderUpload(el) {
  el.innerHTML = `
    <div class="page-heading">
      <div class="page-title">Upload <em>Invoice</em></div>
      <div class="page-desc">Supports PDF, JPG, and PNG — up to 20 MB per file</div>
    </div>
    <div class="upload-zone-wrap">
      <div class="upload-zone" id="drop-zone">
        <input type="file" id="file-picker" accept=".pdf,.jpg,.jpeg,.png" />
        <div class="upload-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 12 15 15"/>
          </svg>
        </div>
        <h3>Drop your invoice here</h3>
        <p>Drag a file onto this area, or click to browse</p>
        <div class="upload-pill-row">
          <span class="upload-pill">PDF</span>
          <span class="upload-pill">JPG · JPEG</span>
          <span class="upload-pill">PNG</span>
          <span class="upload-pill">Max 20 MB</span>
        </div>
      </div>
      <div id="upload-feedback"></div>
    </div>`;

  const zone   = document.getElementById('drop-zone');
  const picker = document.getElementById('file-picker');

  picker.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
}

async function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf','jpg','jpeg','png'].includes(ext)) {
    showToast('Only PDF, JPG, and PNG files are supported', 'error'); return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast('File is larger than 20 MB', 'error'); return;
  }

  const fb = document.getElementById('upload-feedback');
  fb.innerHTML = `
    <div class="upload-state-card">
      <div class="upload-file-row">
        <div class="file-icon-sm">${ext === 'pdf' ? '📄' : '🖼'}</div>
        <div style="flex:1;min-width:0">
          <div class="file-info-name">${escHtml(file.name)}</div>
          <div class="file-info-size">${fmtBytes(file.size)}</div>
        </div>
        <span class="spinner"></span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill animated" id="prog-fill" style="width:18%"></div>
      </div>
      <div class="upload-step-label" id="step-label">Uploading to Azure Blob Storage…</div>
    </div>`;

  // Animate progress while uploading
  let pct = 18;
  const ticker = setInterval(() => {
    pct = Math.min(pct + 4, 72);
    const el = document.getElementById('prog-fill');
    if (el) el.style.width = pct + '%';
  }, 350);

  try {
    const fd = new FormData();
    fd.append('file', file);
    const result = await request('POST', '/invoices/upload', fd, true);

    clearInterval(ticker);
    setUploadStep('Queued — Azure AI Document Intelligence is analyzing…', 80);
    startPollingUpload(result.id);

  } catch (e) {
    clearInterval(ticker);
    fb.innerHTML = `<div class="alert alert-error" style="margin-top:16px">
      <span class="alert-icon">✕</span>
      <div><strong>Upload failed</strong><br><span style="font-size:12px">${escHtml(e.message)}</span></div>
    </div>`;
  }
}

function setUploadStep(label, pct) {
  const fill  = document.getElementById('prog-fill');
  const lbl   = document.getElementById('step-label');
  if (fill) fill.style.width = pct + '%';
  if (lbl)  lbl.textContent  = label;
}

function startPollingUpload(id) {
  let attempts = 0;
  poll('upload', async () => {
    attempts++;
    if (attempts > 80) { clearPoll('upload'); return; }

    try {
      const inv = await request('GET', `/invoices/${id}`);
      if (inv.status === 'completed') {
        clearPoll('upload');
        setUploadStep('Extraction complete — redirecting…', 100);
        const fill = document.getElementById('prog-fill');
        if (fill) { fill.classList.remove('animated'); fill.style.background = 'var(--accent)'; }
        showToast('Invoice processed successfully', 'success', inv.data?.vendor_name?.value || 'Invoice ready');
        setTimeout(() => go('detail', id), 900);
      } else if (inv.status === 'failed') {
        clearPoll('upload');
        setUploadStep('Processing failed', 100);
        const fill = document.getElementById('prog-fill');
        if (fill) { fill.classList.remove('animated'); fill.style.background = 'var(--red)'; }
        showToast('AI processing failed. Check Azure credentials.', 'error');
      } else {
        const dots = '.'.repeat((attempts % 3) + 1);
        setUploadStep(`Azure AI analyzing${dots}`, Math.min(80 + attempts, 93));
      }
    } catch (_) {}
  }, 2500);
}

/* ───────────────────────────────────────────
   PAGE: ALL INVOICES
─────────────────────────────────────────── */
async function renderInvoices(el) {
  el.innerHTML = `
    <div class="page-heading">
      <div class="page-title">All <em>Invoices</em></div>
      <div class="page-desc">Complete history of every uploaded and processed invoice</div>
    </div>
    <div class="panel">
      <div class="panel-header">
        <span class="panel-title">Invoice History</span>
        <span class="panel-meta" id="inv-count">Loading…</span>
      </div>
      <div id="all-inv-body">
        <div style="padding:40px;display:flex;justify-content:center"><span class="spinner spinner-lg"></span></div>
      </div>
    </div>`;

  try {
    const data = await request('GET', '/invoices/?limit=100');
    const items = data.items || [];
    document.getElementById('inv-count').textContent = `${data.total ?? items.length} total`;
    renderInvoiceRows('all-inv-body', items, false);

    // Poll if any are processing
    if (items.some(i => i.status === 'processing')) {
      poll('invoices', async () => {
        const fresh = await request('GET', '/invoices/?limit=100').catch(() => null);
        if (!fresh) return;
        renderInvoiceRows('all-inv-body', fresh.items || [], false);
        if (!fresh.items.some(i => i.status === 'processing')) clearPoll('invoices');
      });
    }
  } catch (e) {
    document.getElementById('all-inv-body').innerHTML = `
      <div class="alert alert-error" style="margin:20px">
        <span class="alert-icon">⚠</span>${escHtml(e.message)}
      </div>`;
  }
}

/* ───────────────────────────────────────────
   PAGE: INVOICE DETAIL
─────────────────────────────────────────── */
async function renderDetail(el, id) {
  el.innerHTML = `
    <button class="back-btn" onclick="go('invoices')">
      <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9.707 16.707a1 1 0 0 1-1.414 0l-6-6a1 1 0 0 1 0-1.414l6-6a1 1 0 0 1 1.414 1.414L5.414 9H17a1 1 0 0 1 0 2H5.414l4.293 4.293a1 1 0 0 1 0 1.414z"/></svg>
      Back to Invoices
    </button>
    <div id="detail-body">
      <div style="display:flex;justify-content:center;padding:60px 0">
        <span class="spinner spinner-lg"></span>
      </div>
    </div>`;

  await loadDetail(id);

  // If processing, keep polling
  poll('detail', async () => {
    const inv = await request('GET', `/invoices/${id}`).catch(() => null);
    if (!inv) return;
    if (inv.status !== 'processing' && inv.status !== 'pending') {
      clearPoll('detail');
      await loadDetail(id);
    }
  }, 2500);
}

async function loadDetail(id) {
  const el = document.getElementById('detail-body');
  if (!el) return;
  try {
    const inv = await request('GET', `/invoices/${id}`);
    if (inv.status === 'processing' || inv.status === 'pending') {
      el.innerHTML = `
        <div class="panel" style="max-width:520px">
          <div class="panel-header"><span class="panel-title">Processing…</span></div>
          <div style="padding:36px 24px;text-align:center">
            <div class="spinner spinner-lg" style="margin:0 auto 16px"></div>
            <div style="font-size:14px;font-weight:600;margin-bottom:6px">Azure AI is reading your invoice</div>
            <div style="font-size:13px;color:var(--text-2)">This usually takes 5–20 seconds</div>
            <div style="margin-top:18px;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--mono);color:var(--text-3)">${id}</div>
          </div>
        </div>`;
      return;
    }
    if (inv.status === 'failed') {
      el.innerHTML = `
        <div class="alert alert-error">
          <span class="alert-icon">✕</span>
          <div>
            <strong>Processing failed</strong><br>
            <span style="font-size:12px">Azure AI could not extract data. Ensure the file is a clear, readable invoice and your Azure credentials are valid.</span>
          </div>
        </div>`;
      return;
    }

    const d = inv.data || {};
    const confClass = c => c >= 0.9 ? 'high' : c >= 0.6 ? 'mid' : 'low';
    const confLabel = c => c != null ? `${(c*100).toFixed(0)}% confidence` : '';

    el.innerHTML = `
      <!-- Meta bar -->
      <div class="detail-meta-bar">
        <div class="meta-chip">
          <span class="chip-label">ID</span>
          <span class="chip-val">${id.slice(0,8)}…</span>
        </div>
        <div class="meta-divider"></div>
        <div class="meta-chip">
          <span class="chip-label">Status</span>
          ${statusBadge(inv.status)}
        </div>
        <div class="meta-divider"></div>
        <div class="meta-chip">
          <span class="chip-label">Confidence</span>
          ${inv.confidence_score != null ? confBar(inv.confidence_score) : '<span style="font-size:12px;color:var(--text-3)">—</span>'}
        </div>
        <div class="meta-divider"></div>
        <div class="meta-chip">
          <span class="chip-label">Date</span>
          <span class="chip-val">${fmtDate(inv.created_at)}</span>
        </div>
        ${inv.file_url ? `
        <div class="meta-divider"></div>
        <a href="${escAttr(inv.file_url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-xs" style="gap:4px" onclick="event.stopPropagation()">
          <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 1 0 0 2h2.586l-6.293 6.293a1 1 0 1 0 1.414 1.414L15 6.414V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5zM5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 0 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5z"/></svg>
          View file
        </a>` : ''}
        <div class="meta-divider"></div>
        <button class="btn btn-secondary btn-xs" style="gap:4px;color:var(--text-2)" onclick="doReprocessInvoice('${escAttr(id)}')">
          <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path d="M4 2a1 1 0 0 1 1 1v1h10V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1zM4 6H3v11h14V6h-1v1a1 1 0 1 1-2 0V6H6v1a1 1 0 1 1-2 0V6z"/></svg>
          Reprocess
        </button>
        <div class="meta-divider"></div>
        <button class="btn btn-danger btn-xs" style="gap:4px" onclick="doDeleteInvoice('${escAttr(id)}')">
          <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9zM7 8a1 1 0 0 1 2 0v6a1 1 0 1 1-2 0V8zm5-1a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1z" clip-rule="evenodd"/></svg>
          Delete
        </button>
      </div>

      <!-- Two-column grid: Vendor / Buyer -->
      <div class="detail-grid">
        <div class="detail-card">
          <div class="detail-card-header">
            <span class="detail-card-icon">🏢</span>
            <span class="detail-card-title">Seller / Vendor</span>
          </div>
          <div class="detail-card-body">
            ${kvRow('Vendor Name',    d.vendor_name,     false)}
            ${kvRow('GSTIN',          d.vendor_gstin,    true)}
          </div>
        </div>
        <div class="detail-card">
          <div class="detail-card-header">
            <span class="detail-card-icon">🏬</span>
            <span class="detail-card-title">Buyer / Customer</span>
          </div>
          <div class="detail-card-body">
            ${kvRow('Buyer Name',     d.buyer_name,      false)}
            ${kvRow('Buyer GSTIN',    d.buyer_gstin,     true)}
          </div>
        </div>
      </div>

      <!-- Two-column grid: Invoice Details / Tax & Totals -->
      <div class="detail-grid">
        <div class="detail-card">
          <div class="detail-card-header">
            <span class="detail-card-icon">🧾</span>
            <span class="detail-card-title">Invoice Details</span>
          </div>
          <div class="detail-card-body">
            ${kvRow('Invoice Number', d.invoice_number,  true)}
            ${kvRow('Invoice Date',   d.invoice_date,    false)}
          </div>
        </div>
        <div class="detail-card">
          <div class="detail-card-header">
            <span class="detail-card-icon">₹</span>
            <span class="detail-card-title">Tax & Totals</span>
          </div>
          <div class="detail-card-body">
            ${kvRow('Subtotal',       d.subtotal,        true, 'currency')}
            ${kvRow('CGST',           d.cgst,            true, 'currency')}
            ${kvRow('SGST',           d.sgst,            true, 'currency')}
            ${kvRow('IGST',           d.igst,            true, 'currency')}
            ${kvRow('Invoice Total',  d.total_amount,    true, 'currency', true)}
          </div>
        </div>
      </div>

      <!-- Line Items -->
      ${lineItemsSection(d.line_items)}

      <!-- Raw file info -->
      ${inv.original_filename ? `
      <div style="margin-top:16px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-3)">
        <span style="font-family:var(--mono)">Original file:</span>
        <span style="font-family:var(--mono);color:var(--text-2)">${escHtml(inv.original_filename)}</span>
        <span>·</span>
        <span>Azure AI Document Intelligence (prebuilt-invoice)</span>
      </div>` : ''}
    `;

  } catch (e) {
    if (el) el.innerHTML = `
      <div class="alert alert-error">
        <span class="alert-icon">⚠</span>${escHtml(e.message)}
      </div>`;
  }
}

function kvRow(label, field, isMono = false, type = 'text', highlight = false) {
  const val  = field?.value ?? null;
  const conf = field?.confidence ?? null;
  const ccls = conf != null ? (conf >= 0.9 ? 'high' : conf >= 0.6 ? 'mid' : 'low') : '';

  let display;
  if (val == null) {
    display = `<span class="kv-empty">—</span>`;
  } else if (type === 'currency') {
    display = `<span class="kv-val${highlight ? ' highlight' : ''}">₹${Number(val).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>`;
  } else {
    display = `<span class="kv-val${isMono ? '' : ' text-val'}${highlight ? ' highlight' : ''}">${escHtml(String(val))}</span>`;
  }

  return `<div class="kv-row">
    <span class="kv-key">${label}</span>
    <div class="kv-right">
      ${display}
      ${conf != null ? `<span class="kv-conf ${ccls}">${(conf*100).toFixed(0)}% conf</span>` : ''}
    </div>
  </div>`;
}

function lineItemsSection(items) {
  if (!items || items.length === 0) return '';
  return `
    <div class="panel" style="margin-top:0">
      <div class="panel-header">
        <span class="panel-title">Line Items</span>
        <span class="panel-meta">${items.length} item${items.length !== 1 ? 's' : ''}</span>
      </div>
      <table class="data-table">
        <thead><tr>
          <th>Description</th>
          <th>HSN Code</th>
          <th style="text-align:right">Qty</th>
          <th style="text-align:right">Unit Rate</th>
          <th style="text-align:right">Amount</th>
        </tr></thead>
        <tbody>
          ${items.map(item => `<tr style="cursor:default">
            <td>${escHtml(item.description || '—')}</td>
            <td style="font-family:var(--mono);font-size:12px;color:var(--text-2)">${escHtml(item.hsn_code || '—')}</td>
            <td style="text-align:right;font-family:var(--mono)">${item.quantity != null ? item.quantity : '—'}</td>
            <td style="text-align:right;font-family:var(--mono)">${item.rate != null ? '₹' + Number(item.rate).toLocaleString('en-IN') : '—'}</td>
            <td style="text-align:right;font-family:var(--mono);font-weight:600">${item.amount != null ? '₹' + Number(item.amount).toLocaleString('en-IN', {minimumFractionDigits:2}) : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ───────────────────────────────────────────
   SHARED: INVOICE TABLE ROWS
─────────────────────────────────────────── */
function renderInvoiceRows(containerId, items, isShort) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items || items.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <div class="empty-state-title">No invoices yet</div>
        <div class="empty-state-desc">Upload your first invoice to see extracted data here</div>
        <button class="btn btn-primary" onclick="go('upload')">Upload Invoice</button>
      </div>`;
    return;
  }
  el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Invoice #</th>
        <th>Vendor</th>
        <th style="text-align:right">Amount</th>
        <th>Status</th>
        <th>Confidence</th>
        <th>Date</th>
        <th style="text-align:right">Actions</th>
      </tr></thead>
      <tbody>
        ${items.map(inv => `
          <tr onclick="go('detail','${escAttr(inv.id)}')">
            <td style="font-family:var(--mono);font-size:12px;color:var(--text-2)">
              ${inv.invoice_number
                ? `<span style="color:var(--text);font-weight:600">${escHtml(inv.invoice_number)}</span>`
                : `<span style="color:var(--text-3)">${inv.id.slice(0,8)}…</span>`}
            </td>
            <td style="font-weight:500;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${inv.vendor_name ? escHtml(inv.vendor_name) : '<span style="color:var(--text-3)">—</span>'}
            </td>
            <td style="text-align:right;font-family:var(--mono)">
              ${inv.total_amount != null
                ? '₹' + Number(inv.total_amount).toLocaleString('en-IN', {maximumFractionDigits:2})
                : '<span style="color:var(--text-3)">—</span>'}
            </td>
            <td>${statusBadge(inv.status)}</td>
            <td>${confBar(inv.confidence_score)}</td>
            <td style="font-family:var(--mono);font-size:12px;color:var(--text-2);white-space:nowrap">${fmtDateShort(inv.created_at)}</td>
            <td style="text-align:right">
              <button class="btn btn-ghost btn-xs" style="color:var(--text-3);padding:2px" onclick="event.stopPropagation(); doDeleteInvoice('${escAttr(inv.id)}')">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9zM7 8a1 1 0 0 1 2 0v6a1 1 0 1 1-2 0V8zm5-1a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1z" clip-rule="evenodd"/></svg>
              </button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

/* ───────────────────────────────────────────
   UI HELPERS
─────────────────────────────────────────── */
function statusBadge(status) {
  const map = { completed: 'completed', processing: 'processing', failed: 'failed', pending: 'pending' };
  const cls = map[status] || 'pending';
  return `<span class="badge badge-${cls}"><span class="badge-dot"></span>${status}</span>`;
}

function confBar(score) {
  if (score == null) return '<span style="color:var(--text-3);font-size:12px;font-family:var(--mono)">—</span>';
  const pct = Math.round(score * 100);
  const color = pct >= 90 ? 'var(--green)' : pct >= 60 ? 'var(--amber)' : 'var(--red)';
  return `<div class="conf-wrap">
    <div class="conf-track"><div class="conf-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="conf-label" style="color:${color}">${pct}%</span>
  </div>`;
}

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
       + ' ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:false });
}

function fmtDateShort(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  return (b/(1024*1024)).toFixed(1) + ' MB';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) { return escHtml(s); }

/* ───────────────────────────────────────────
   TOAST
─────────────────────────────────────────── */
function showToast(msg, type = 'info', sub = '') {
  const root = document.getElementById('toast-root');
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <span class="toast-icon">${icons[type] || '·'}</span>
    <div>
      <div class="toast-msg">${escHtml(msg)}</div>
      ${sub ? `<div class="toast-sub">${escHtml(sub)}</div>` : ''}
    </div>`;
  root.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 4000);
}