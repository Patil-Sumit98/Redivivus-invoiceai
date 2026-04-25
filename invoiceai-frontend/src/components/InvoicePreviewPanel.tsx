/**
 * InvoicePreviewPanel
 *
 * A slide-in right-side panel that opens when the user clicks the Eye icon
 * on any invoice row in the InvoicesPage.
 *
 * Shows:
 *  - PDF / image viewer (using file_url_sas from the detail API)
 *  - Extracted data fields with confidence bars
 *  - Status badge + ingestion method
 *  - Quick "Open Full Detail" link (does NOT download anything)
 */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useInvoiceStatus } from '../hooks/useInvoiceStatus';
import { StatusBadge } from './StatusBadge';
import { X, ExternalLink, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

interface InvoicePreviewPanelProps {
  invoiceId: string | null;
  onClose: () => void;
}

const Field = ({ label, value, currency = false }: { label: string; value: any; currency?: boolean }) => {
  const raw = currency ? formatCurrency(value?.value) : (value?.value || '—');
  const conf = value?.confidence !== undefined && value?.confidence !== null
    ? Math.round(value.confidence * 100)
    : null;

  let barColor = 'bg-ink-300';
  if (conf !== null) {
    if (conf >= 90) barColor = 'bg-emerald-500';
    else if (conf >= 60) barColor = 'bg-amber-500';
    else barColor = 'bg-red-500';
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</span>
      <span className="text-sm font-semibold text-ink-900 truncate" title={String(raw)}>{raw}</span>
      {conf !== null && (
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-ink-100 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${conf}%` }} />
          </div>
          <span className="text-[10px] font-semibold text-ink-400">{conf}%</span>
        </div>
      )}
    </div>
  );
};

export const InvoicePreviewPanel = ({ invoiceId, onClose }: InvoicePreviewPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  // FIX: Lock the SAS URL on first load so background refetches don't change
  // the iframe src and trigger repeated downloads.
  const lockedFileUrl = useRef<string>('');
  const { data: invoice, isLoading } = useInvoiceStatus(invoiceId ?? undefined, {
    disablePolling: true,
  });

  // Reset the locked URL when switching to a different invoice
  useEffect(() => {
    lockedFileUrl.current = '';
  }, [invoiceId]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close on outside click — only when panel is open
  useEffect(() => {
    if (!invoiceId) return; // don't attach when closed
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    // 80ms delay prevents the opening click from immediately closing
    const t = setTimeout(() => document.addEventListener('mousedown', handleClick), 80);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handleClick); };
  }, [invoiceId, onClose]);

  const isOpen = !!invoiceId;

  const data = invoice?.data_json || invoice?.data;
  // Lock the file URL on first valid value
  const freshUrl = invoice?.file_url_sas || '';
  if (freshUrl && !lockedFileUrl.current) lockedFileUrl.current = freshUrl;
  // Reset lock when invoice changes (different panel selection)
  const fileUrl = lockedFileUrl.current;
  const isPDF = invoice?.original_filename?.toLowerCase().endsWith('.pdf');
  const hasFile = !!fileUrl;

  const isQR = invoice?.ingestion_method === 'QR' || invoice?.source_type === 'GST_EINVOICE';
  const isOCR = invoice?.ingestion_method === 'OCR' || invoice?.source_type === 'GST_PDF';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink-950/30 backdrop-blur-[2px] transition-opacity duration-300
          ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[780px] bg-white shadow-2xl flex flex-col
          border-l border-ink-200 transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-200 bg-ink-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-5 w-5 text-ink-400 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-ink-900 text-sm truncate max-w-[340px]" title={invoice?.original_filename}>
                {invoice?.original_filename || 'Loading…'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {invoice && <StatusBadge status={invoice.status} />}
                {isQR && (
                  <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border border-indigo-200">QR</span>
                )}
                {isOCR && (
                  <span className="bg-sky-100 text-sky-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border border-sky-200">OCR</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {invoice && (
              <Link
                to={`/invoices/${invoice.id}`}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
                onClick={onClose}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Full Detail
              </Link>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-ink-200 text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm"
              title="Close preview (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {isLoading || !invoice ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-ink-400">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm font-semibold">Loading invoice…</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

            {/* Left: Document Viewer */}
            <div className="lg:w-[55%] bg-ink-100 border-b lg:border-b-0 lg:border-r border-ink-200 flex flex-col min-h-0">
              <div className="px-4 py-2 bg-ink-100 border-b border-ink-200 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-ink-500">Source Document</span>
                <span className="text-[10px] font-medium text-ink-400">{formatDate(invoice.created_at)}</span>
              </div>
              <div className="flex-1 overflow-hidden flex items-center justify-center p-3 min-h-[300px]">
                {!hasFile ? (
                  <div className="flex flex-col items-center gap-3 text-ink-400 p-6 text-center">
                    <AlertTriangle className="h-10 w-10 text-ink-300" />
                    <p className="text-sm font-semibold text-ink-500">Preview not available</p>
                    <p className="text-xs text-ink-400">The file link has expired or hasn't been generated yet.</p>
                  </div>
                ) : isPDF ? (
                  <iframe
                    src={fileUrl}
                    className="w-full h-full rounded-lg border border-ink-200 shadow-sm bg-white"
                    title="Invoice PDF"
                    style={{ minHeight: '400px' }}
                  />
                ) : (
                  <img
                    src={fileUrl}
                    alt="Invoice document"
                    className="max-w-full max-h-full object-contain rounded-xl shadow-sm bg-white"
                  />
                )}
              </div>
            </div>

            {/* Right: Extracted Fields */}
            <div className="lg:w-[45%] flex flex-col overflow-y-auto custom-scrollbar">
              <div className="p-4 border-b border-ink-100 bg-ink-50 shrink-0">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-ink-500">Extracted Data</h3>
              </div>

              <div className="flex-1 p-5 space-y-5 overflow-y-auto custom-scrollbar">

                {/* Confidence Ring */}
                {invoice.confidence_score !== null && invoice.confidence_score !== undefined && (
                  <div className="flex items-center gap-4 p-4 bg-ink-50 rounded-xl border border-ink-200">
                    <ConfRing score={invoice.confidence_score} />
                    <div>
                      <p className="text-xs font-bold text-ink-700">Overall Confidence</p>
                      <p className="text-[11px] text-ink-500 mt-0.5">
                        {Math.round(invoice.confidence_score * 100) >= 90
                          ? 'High confidence — data is reliable'
                          : Math.round(invoice.confidence_score * 100) >= 60
                          ? 'Moderate — review recommended'
                          : 'Low — manual verification required'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Vendor & Buyer */}
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-3">Parties</p>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-xl border border-ink-200 shadow-sm">
                    <Field label="Vendor Name" value={data?.vendor_name} />
                    <Field label="Vendor GSTIN" value={data?.vendor_gstin} />
                    <Field label="Buyer Name" value={data?.buyer_name} />
                    <Field label="Buyer GSTIN" value={data?.buyer_gstin} />
                  </div>
                </section>

                {/* Invoice Details */}
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-3">Invoice Details</p>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-xl border border-ink-200 shadow-sm">
                    <Field label="Invoice Number" value={data?.invoice_number} />
                    <Field label="Invoice Date" value={data?.invoice_date} />
                  </div>
                </section>

                {/* Financial */}
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-3">Taxes & Total</p>
                  <div className="grid grid-cols-3 gap-3 p-4 bg-white rounded-xl border border-ink-200 shadow-sm">
                    <Field label="CGST" value={data?.cgst} currency />
                    <Field label="SGST" value={data?.sgst} currency />
                    <Field label="IGST" value={data?.igst} currency />
                  </div>
                  <div className="mt-3 p-4 bg-ink-950 rounded-xl flex items-center justify-between shadow-lg">
                    <span className="text-ink-400 text-xs font-bold uppercase tracking-widest">Grand Total</span>
                    <span className="text-white font-mono font-black text-2xl tracking-tight">
                      {formatCurrency(data?.total_amount?.value !== null && data?.total_amount?.value !== undefined
                        ? Number(data.total_amount.value) : null)}
                    </span>
                  </div>
                </section>

                {/* GST Flags (if any) */}
                {(() => {
                  const flags = invoice.gst_rules_json?.flags;
                  return flags && flags.length > 0 ? (
                    <section>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-3">GST Compliance Flags</p>
                      <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-1.5">
                        {flags.map((f: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-red-700 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// Small confidence ring
const ConfRing = ({ score }: { score: number }) => {
  const pct = Math.round(score * 100);
  const r = 20;
  const circ = 2 * Math.PI * r;
  let stroke = '#6b7280';
  if (pct >= 90) stroke = '#10b981';
  else if (pct >= 60) stroke = '#f59e0b';
  else stroke = '#ef4444';

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={r} fill="none" stroke={stroke} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ - (circ * pct) / 100}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-black" style={{ color: stroke }}>{pct}%</span>
      </div>
    </div>
  );
};
