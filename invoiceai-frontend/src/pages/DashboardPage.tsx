import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardStats, useInvoiceList } from '../hooks/useInvoiceList';
import { CheckCircle, AlertCircle, FileText, Clock, ArrowRight } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

export const DashboardPage = () => {
  const { data: stats } = useDashboardStats();
  // Fetch up to 100 items to get a meaningful sample for processing stats
  const { data: listPayload } = useInvoiceList({ limit: 100 });
  
  const items = listPayload?.items || [];
  
  // Computations for Processing Method
  const { qrPct, ocrPct } = useMemo(() => {
    if (items.length === 0) return { qrPct: 0, ocrPct: 0 };
    const qrCount = items.filter(i => 
      i.ingestion_method === 'QR' || i.source_type === 'GST_EINVOICE'
    ).length;
    const ocrCount = items.filter(i => 
      i.ingestion_method === 'OCR' || i.source_type === 'GST_PDF' || i.ingestion_method === 'HUMAN'
    ).length;
    
    // If we have items but none mapped to these logic yet, prevent div by 0
    const totalKnown = qrCount + ocrCount || 1; 
    return {
      qrPct: Math.round((qrCount / totalKnown) * 100),
      ocrPct: Math.round((ocrCount / totalKnown) * 100),
    };
  }, [items]);

  // Computations for Avg Confidence
  const avgConf = useMemo(() => {
    const autoApproved = items.filter(i => 
      i.status === 'AUTO_APPROVED' || i.status === 'VERIFIED'
    );
    if (autoApproved.length === 0) return 0;
    const sum = autoApproved.reduce((acc, curr) => acc + (curr.confidence_score || 0), 0);
    return Math.round((sum / autoApproved.length) * 100);
  }, [items]);

  let confColorClass = 'text-green-500 stroke-green-500';
  if (avgConf < 60) confColorClass = 'text-red-500 stroke-red-500';
  else if (avgConf <= 90) confColorClass = 'text-amber-500 stroke-amber-500';

  const todayStr = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).format(new Date());

  const getRowStyling = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'AUTO_APPROVED' || s === 'VERIFIED') return 'status-stripe-green bg-green-50/30 hover:bg-ink-50';
    if (s === 'NEEDS_REVIEW') return 'status-stripe-amber bg-amber-50/30 hover:bg-ink-50';
    if (s === 'HUMAN_REQUIRED' || s === 'REJECTED' || s === 'FAILED') return 'status-stripe-red bg-red-50/30 hover:bg-ink-50';
    if (s === 'PROCESSING' || s === 'PENDING') return 'status-stripe-blue bg-blue-50/20 hover:bg-ink-50';
    return 'status-stripe-gray bg-white hover:bg-ink-50';
  };

  const parseStatusText = (status: string) => status.replace(/_/g, ' ');

  // Table items (limit to 10 for display)
  const displayItems = items.slice(0, 10);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* SECTION 1: Page Header */}
      <header>
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Overview</h1>
        <p className="text-ink-500 text-sm mt-1">{todayStr}</p>
      </header>
      
      {/* SECTION 2: Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl border border-ink-200 shadow-sm p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-ink-500 text-xs font-medium uppercase tracking-wide">Total Processed</h2>
            <div className="p-2 bg-ink-100 rounded-lg">
              <FileText className="h-5 w-5 text-ink-600" />
            </div>
          </div>
          <div className="text-4xl font-bold text-ink-900">{stats?.total || 0}</div>
        </div>

        <div className="bg-white rounded-xl border border-ink-200 shadow-sm p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-ink-500 text-xs font-medium uppercase tracking-wide">Auto-Approved</h2>
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="text-4xl font-bold text-green-600">{stats?.completed || 0}</div>
        </div>

        <div className="bg-white rounded-xl border border-ink-200 shadow-sm p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-ink-500 text-xs font-medium uppercase tracking-wide">Awaiting Review</h2>
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <div className="text-4xl font-bold text-amber-600">{stats?.processing || 0}</div>
        </div>

        <div className="bg-white rounded-xl border border-ink-200 shadow-sm p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-ink-500 text-xs font-medium uppercase tracking-wide">Failed / Rejected</h2>
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
          </div>
          <div className="text-4xl font-bold text-red-600">{stats?.failed || 0}</div>
        </div>
      </div>

      {/* SECTION 3: Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        
        {/* LEFT COLUMN: Recent Invoices Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-ink-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between bg-white shrink-0">
            <h3 className="font-semibold text-lg text-ink-900 tracking-tight">Recent Invoices</h3>
            <Link to="/invoices" className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-ink-50/50 text-ink-500 font-medium">
                <tr>
                  <th className="px-5 py-3 border-b border-ink-100 font-medium">Vendor</th>
                  <th className="px-5 py-3 border-b border-ink-100 font-medium">Invoice #</th>
                  <th className="px-5 py-3 border-b border-ink-100 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 border-b border-ink-100 font-medium text-center">Status</th>
                  <th className="px-5 py-3 border-b border-ink-100 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-ink-900">
                {displayItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-ink-400">
                      No invoices found. Use the Upload tab to add new documents.
                    </td>
                  </tr>
                ) : (
                  displayItems.map(inv => (
                    <tr key={inv.id} className={`transition-colors cursor-pointer ${getRowStyling(inv.status)}`} onClick={() => window.location.href = `/invoices/${inv.id}`}>
                      <td className="px-5 py-3.5 font-medium">{inv.vendor_name || '—'}</td>
                      <td className="px-5 py-3.5 text-ink-600">{inv.invoice_number || '—'}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-medium">{formatCurrency(inv.total_amount)}</td>
                      <td className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-ink-600">
                        {parseStatusText(inv.status)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-ink-500">{formatDate(inv.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: Extra Cards */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Card A: Processing Method */}
          <div className="bg-white rounded-xl border border-ink-200 shadow-sm p-6">
            <h3 className="font-semibold text-lg text-ink-900 tracking-tight mb-6">Processing Method</h3>
            
            <div className="space-y-5 flex flex-col">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium text-ink-700">QR Detection</span>
                  <span className="text-sm font-bold text-ink-900">{qrPct}%</span>
                </div>
                <div className="w-full bg-ink-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-indigo-500 h-2 rounded-full transition-all duration-700" style={{ width: `${qrPct}%` }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium text-ink-700">AI OCR</span>
                  <span className="text-sm font-bold text-ink-900">{ocrPct}%</span>
                </div>
                <div className="w-full bg-ink-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-sky-500 h-2 rounded-full transition-all duration-700" style={{ width: `${ocrPct}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Card B: Avg Confidence */}
          <div className="bg-white rounded-xl border border-ink-200 shadow-sm p-6 flex flex-col items-center text-center">
            <h3 className="font-semibold text-lg text-ink-900 tracking-tight w-full text-left mb-6">Avg Confidence</h3>
            
            <div className="relative w-36 h-36 flex flex-col items-center justify-center my-4">
              {/* Circular progress SVG */}
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle cx="72" cy="72" r="64" fill="none" className="stroke-ink-100" strokeWidth="12" />
                <circle 
                  cx="72" cy="72" r="64" 
                  fill="none" 
                  className={`transition-all duration-1000 ease-out ${avgConf > 0 ? confColorClass : 'stroke-ink-200'}`} 
                  strokeWidth="12" 
                  strokeDasharray="402" /* 2 * PI * 64 roughly */
                  strokeDashoffset={402 - (402 * avgConf) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <span className={`text-4xl font-bold ${confColorClass.split(' ')[0]}`}>{avgConf}%</span>
            </div>
            
            <p className="text-sm text-ink-500 mt-4 leading-relaxed max-w-[200px]">
              across all auto-approved invoices
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};