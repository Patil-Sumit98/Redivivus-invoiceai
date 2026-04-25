import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInvoiceList, useDeleteInvoice } from '../hooks/useInvoiceList';
import { InvoicePreviewPanel } from '../components/InvoicePreviewPanel';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Search, Eye, Trash2, ChevronLeft, ChevronRight, Loader2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../components/ui/alert-dialog';

const CompactConfidenceBar = ({ score }: { score: number | null | undefined }) => {
  if (score === null || score === undefined) return <span className="text-ink-400 text-xs">—</span>;
  const scorePct = Math.round(score * 100);
  let colorClass = 'bg-red-500';
  if (score >= 0.90) colorClass = 'bg-green-500';
  else if (score >= 0.60) colorClass = 'bg-amber-500';

  return (
    <div className="flex items-center gap-2 w-full min-w-[100px]">
      <div className="flex-1 h-2 bg-ink-200 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} transition-all`} style={{ width: `${scorePct}%` }} />
      </div>
      <span className="text-xs font-semibold text-ink-700 min-w-[28px] text-right">{scorePct}%</span>
    </div>
  );
};

export const InvoicesPage = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  // ID of invoice whose preview panel is open (null = closed)
  const [previewId, setPreviewId] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 20;

  const { data, isLoading } = useInvoiceList({
    skip: (page - 1) * ITEMS_PER_PAGE,
    limit: ITEMS_PER_PAGE,
    status: statusFilter,
    search: search,
  });

  const { mutate: deleteInvoice } = useDeleteInvoice();

  const handleDelete = (id: string) => {
    // Close the preview if deleting the currently previewed invoice
    if (previewId === id) setPreviewId(null);
    deleteInvoice(id, {
      onSuccess: () => toast.success('Invoice deleted successfully!'),
      onError: () => toast.error('Failed to delete invoice.'),
    });
  };

  const processedData = useMemo(() => {
    if (!data?.items) return [];
    return data.items;
  }, [data]);

  const totalItems = data?.total || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const getBorderColor = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'AUTO_APPROVED' || s === 'VERIFIED') return 'border-green-500';
    if (s === 'NEEDS_REVIEW') return 'border-amber-500';
    if (s === 'HUMAN_REQUIRED' || s === 'REJECTED' || s === 'FAILED') return 'border-red-500';
    if (s === 'PROCESSING' || s === 'PENDING') return 'border-blue-500';
    return 'border-ink-300';
  };

  return (
    <>
      {/* Slide-out preview panel — rendered outside table to avoid z-index issues */}
      <InvoicePreviewPanel
        invoiceId={previewId}
        onClose={() => setPreviewId(null)}
      />

      <div className="max-w-7xl mx-auto flex flex-col h-full space-y-6 pb-12">

        {/* Page Heading */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Invoice History</h1>
          <span className="bg-ink-100 text-ink-600 text-xs font-bold px-2.5 py-1 rounded-md">
            {totalItems} total
          </span>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-3 rounded-xl border border-ink-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex relative w-full md:w-80 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <Input
              placeholder="Search documents or vendors..."
              className="pl-9 w-full bg-ink-50/50 border-ink-200 focus:bg-white h-9 text-sm"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex gap-1.5 bg-ink-50 p-1 rounded-lg w-full md:w-auto overflow-x-auto shrink-0 custom-scrollbar border border-ink-100">
            {['All', 'Processing', 'Auto-Approved', 'Needs Review', 'Failed'].map(status => (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold whitespace-nowrap rounded-md transition-all
                  ${statusFilter === status
                    ? 'bg-white text-ink-900 shadow-sm border border-ink-200'
                    : 'text-ink-500 hover:text-ink-700 hover:bg-ink-100/50 border border-transparent'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-ink-200 shadow-sm rounded-xl overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-ink-50 border-b border-ink-200 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider">Document</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider text-right">Amount</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider pl-8">Confidence</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-ink-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                      <span className="font-semibold text-sm">Loading records...</span>
                    </td>
                  </tr>
                ) : processedData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-ink-400 font-medium">
                      No results found for your filters.
                    </td>
                  </tr>
                ) : (
                  processedData.map((inv) => {
                    const isSelected = previewId === inv.id;
                    return (
                      <tr
                        key={inv.id}
                        className={`group transition-colors cursor-pointer
                          ${isSelected ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-ink-50/50'}`}
                        onClick={() => setPreviewId(isSelected ? null : inv.id)}
                      >
                        <td className={`px-5 py-3.5 border-l-[4px] ${getBorderColor(inv.status)}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-ink-900 truncate max-w-[180px]" title={inv.original_filename}>
                              {inv.original_filename}
                            </span>
                            {(inv.ingestion_method === 'QR' || inv.source_type === 'GST_EINVOICE') ? (
                              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border border-indigo-100">QR</span>
                            ) : (inv.ingestion_method === 'OCR' || inv.source_type === 'GST_PDF') ? (
                              <span className="bg-sky-50 text-sky-600 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide border border-sky-100">OCR</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-ink-500 truncate max-w-[160px] block" title={inv.vendor_name || '—'}>
                            {inv.vendor_name || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-ink-600 font-medium">
                          {formatDate(inv.created_at)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-ink-900">
                          {formatCurrency(inv.total_amount)}
                        </td>
                        <td className="px-5 py-3.5 pl-8">
                          <CompactConfidenceBar score={inv.confidence_score} />
                        </td>
                        <td className="px-5 py-3.5 text-right w-[120px]">
                          {/* Stop row-click propagation for action buttons */}
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Preview toggle — Eye icon */}
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Preview invoice"
                              className={`h-8 w-8 p-0 transition-colors
                                ${isSelected
                                  ? 'text-blue-600 bg-blue-100 hover:bg-blue-200'
                                  : 'text-ink-400 hover:text-blue-600 hover:bg-blue-50'}`}
                              onClick={() => setPreviewId(isSelected ? null : inv.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {/* Open full detail page */}
                            <Link to={`/invoices/${inv.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Open full detail page"
                                className="h-8 w-8 p-0 text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>

                            {/* Delete */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Delete invoice"
                                  className="h-8 w-8 p-0 text-ink-400 hover:text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. The invoice record and extracted data will be permanently removed.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => handleDelete(inv.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="bg-white border-t border-ink-200 p-4 flex items-center justify-between shrink-0">
            <span className="text-xs font-medium text-ink-500">
              Showing <span className="font-bold text-ink-900">{(page-1)*ITEMS_PER_PAGE + (processedData.length > 0 ? 1 : 0)}</span>–<span className="font-bold text-ink-900">{(page-1)*ITEMS_PER_PAGE + processedData.length}</span> of <span className="font-bold text-ink-900">{totalItems}</span> results
            </span>
            <div className="flex items-center gap-3">
              <div className="bg-ink-50 text-ink-600 text-xs font-bold px-3 py-1.5 rounded-md border border-ink-200">
                Page {page} of {totalPages === 0 ? 1 : totalPages}
              </div>
              <div className="flex gap-1.5">
                <Button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  variant="outline"
                  className="h-8 px-3 bg-white border-ink-200 hover:bg-ink-50 text-xs font-semibold"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <Button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || totalPages === 0}
                  variant="outline"
                  className="h-8 px-3 bg-white border-ink-200 hover:bg-ink-50 text-xs font-semibold"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};
