import { useDashboardStats, useInvoiceList } from '../hooks/useInvoiceList';
import { Card, CardContent } from '../components/ui/card';
import { CheckCircle, AlertTriangle, XCircle, FileText, ArrowRight, Zap } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency } from '../utils/formatters';
import { Link } from 'react-router-dom';

export const DashboardPage = () => {
  const { data: stats } = useDashboardStats();
  const { data: listPayload } = useInvoiceList(10);

  const total = stats?.total || 0;
  const autoApprovePct = total > 0 ? Math.round(((stats?.completed || 0) / total) * 100) : 0;
  
  const qrPct = 40;
  const ocrPct = 60;

  const statBoxes = [
    { title: 'Total Invoices', value: stats?.total || 0, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100', sub: 'All uploaded documents' },
    { title: 'Approved', value: stats?.completed || 0, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100', sub: `${autoApprovePct}% auto + verified` },
    { title: 'Pending Review', value: stats?.processing || 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100', sub: 'Processing or needs review' },
    { title: 'Failed / Rejected', value: stats?.failed || 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', sub: 'Errors or rejected' },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between pb-2 border-b border-gray-200">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard Metrics</h2>
      </div>
      
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {statBoxes.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="shadow-sm border-0 ring-1 ring-gray-200 hover:shadow-md transition-shadow bg-white">
              <CardContent className="p-6 flex flex-col items-start gap-4">
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-xl ${stat.bg}`}>
                    <Icon className={`h-8 w-8 ${stat.color}`} />
                    </div>
                </div>
                <div>
                  <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">{stat.title}</p>
                  <div className="flex items-end gap-2 mt-1">
                      <h3 className="text-4xl font-extrabold text-gray-900 leading-none">{stat.value}</h3>
                  </div>
                  <p className="text-xs text-gray-500 font-semibold mt-2 tracking-wide">{stat.sub}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 flex flex-col">
            <Card className="shadow-sm border-0 ring-1 ring-gray-200 flex-1 bg-white flex flex-col">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50 rounded-t-xl shrink-0">
                <h3 className="font-extrabold text-lg text-gray-900 tracking-tight">Recent Historical Activity</h3>
                <Link to="/invoices" className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-800 transition-colors uppercase tracking-wider bg-blue-50 px-3 py-1.5 rounded-md">
                  View full ledger <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <CardContent className="p-0 flex-1">
                 {!listPayload?.items || listPayload.items.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 font-medium min-h-[300px] flex items-center justify-center">No invoices uploaded yet. Start by uploading your first invoice.</div>
                 ) : (
                    <div className="divide-y divide-gray-100">
                        {listPayload.items.map((inv) => (
                           <Link key={inv.id} to={`/invoices/${inv.id}`} className="p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                              <div className="flex items-center gap-4">
                                  <div className="bg-slate-100 p-2.5 rounded-xl shrink-0 flex items-center justify-center ring-1 ring-slate-200 shadow-sm">
                                      <FileText className="h-5 w-5 text-slate-500" />
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                      <span className="font-bold text-gray-900 text-[13px]">{inv.vendor_name || 'Anonymous Vendor'}</span>
                                      <span className="text-[11px] font-bold tracking-wide text-gray-400 truncate max-w-[200px] uppercase">{inv.original_filename}</span>
                                  </div>
                              </div>
                              <div className="flex items-center gap-4 sm:gap-6 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 border-gray-100 pt-3 sm:pt-0">
                                  <span className="font-black text-gray-900 text-sm text-right min-w-[70px]">{formatCurrency(inv.total_amount)}</span>
                                  <div className="w-fit sm:w-[110px] flex justify-end">
                                    <StatusBadge status={inv.status} />
                                  </div>
                              </div>
                           </Link>
                        ))}
                    </div>
                 )}
              </CardContent>
            </Card>
          </div>
          
          <div className="xl:col-span-1 flex flex-col gap-8">
             <Card className="shadow-sm border-0 ring-1 ring-gray-200 bg-white pb-6 rounded-xl">
              <div className="p-6 border-b border-gray-100 bg-slate-50 rounded-t-xl">
                <h3 className="font-extrabold text-lg text-gray-900 tracking-tight">System Breakdown</h3>
              </div>
              <CardContent className="p-6 space-y-6">
                <div>
                   <div className="flex items-center gap-4 mb-3">
                       <span className="w-5 h-5 rounded-md bg-indigo-500 block shadow-inner"></span>
                       <span className="text-[13px] font-bold text-gray-700 uppercase tracking-widest leading-none">QR Code Accuracy ({qrPct}%)</span>
                   </div>
                   <div className="flex items-center gap-4 mb-8">
                       <span className="w-5 h-5 rounded-md bg-blue-400 block shadow-inner"></span>
                       <span className="text-[13px] font-bold text-gray-700 uppercase tracking-widest leading-none">Native Azure OCR ({ocrPct}%)</span>
                   </div>

                   <div className="relative w-full h-5 rounded-full overflow-hidden bg-slate-100 flex shadow-inner ring-1 ring-slate-200 mt-2">
                       <div className="h-full bg-indigo-500" style={{ width: `${qrPct}%` }} />
                       <div className="h-full bg-blue-400" style={{ width: `${ocrPct}%` }} />
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xl border-0 bg-gradient-to-br from-indigo-700 to-blue-800 text-white rounded-xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-125 transition-transform duration-700">
                 <Zap className="h-40 w-40" />
              </div>
              <div className="p-8 relative z-10 flex flex-col justify-center h-full">
                <h3 className="font-black text-2xl tracking-tight mb-2 text-white">Quick Infrastructure Hooks</h3>
                <p className="text-indigo-100 text-[13px] leading-relaxed font-semibold mt-2 max-w-sm">
                  InvoiceAI scans for e-Invoice QR codes first for 100% accuracy, then falls back to Azure Document Intelligence OCR for remaining documents.
                </p>
                <div className="mt-8">
                   <Link to="/upload" className="inline-flex items-center justify-center gap-2 bg-white text-indigo-800 font-extrabold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all text-sm w-fit uppercase tracking-wider">
                      Upload Invoice <ArrowRight className="h-4 w-4" />
                   </Link>
                </div>
              </div>
            </Card>
          </div>
      </div>
    </div>
  );
};