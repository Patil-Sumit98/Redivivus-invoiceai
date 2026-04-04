import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInvoiceList, useDeleteInvoice } from '../hooks/useInvoiceList';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { StatusBadge } from '../components/StatusBadge';
import { ConfidenceBar } from '../components/ConfidenceBar';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Search, Eye, Trash2, ChevronLeft, ChevronRight, Loader2, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';

type SortKey = 'date' | 'confidence' | 'total';

export const InvoicesPage = () => {
  const { data, isLoading } = useInvoiceList(1000);
  const { mutate: deleteInvoice, isPending: isDeleting } = useDeleteInvoice();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this invoice securely?')) {
      deleteInvoice(id, {
        onSuccess: () => toast.success('Invoice deleted successfully!'),
        onError: () => toast.error('Failed to delete invoice.'),
      });
    }
  };

  const processedData = useMemo(() => {
    if (!data?.items) return [];
    
    let filtered = data.items.filter(item => {
      if (statusFilter !== 'ALL' && item.status.toUpperCase() !== statusFilter) {
        return false;
      }
      if (search) {
        const query = search.toLowerCase();
        const vMatch = item.vendor_name?.toLowerCase().includes(query) || false;
        const iMatch = item.invoice_number?.toLowerCase().includes(query) || false;
        const fMatch = item.original_filename?.toLowerCase().includes(query) || false;
        if (!vMatch && !iMatch && !fMatch) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let valA, valB;
      if (sortKey === 'date') {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      } else if (sortKey === 'confidence') {
        valA = a.confidence_score || 0;
        valB = b.confidence_score || 0;
      } else {
        valA = a.total_amount || 0;
        valB = b.total_amount || 0;
      }
      
      return sortDesc ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
    });

    return filtered;
  }, [data, search, statusFilter, sortKey, sortDesc]);

  const totalPages = Math.ceil(processedData.length / ITEMS_PER_PAGE);
  const currentChunk = processedData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
           <h2 className="text-3xl font-bold tracking-tight text-gray-900">Invoice History</h2>
           <p className="text-sm font-medium text-gray-500 mt-1">Browse, search, and manage all processed invoices.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between">
         <div className="flex relative w-full md:w-96 shrink-0">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
           <Input 
             placeholder="Search by vendor, invoice #, or file..." 
             className="pl-9 w-full bg-slate-50 border-gray-200 focus:bg-white"
             value={search}
             onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
           />
         </div>
         <div className="flex gap-2 bg-slate-100 p-1.5 rounded-lg w-full md:w-auto overflow-x-auto shrink-0 custom-scrollbar shadow-inner">
           {['ALL', 'PROCESSING', 'AUTO_APPROVED', 'NEEDS_REVIEW'].map(status => (
             <button
               key={status}
               onClick={() => { setStatusFilter(status); setPage(1); }}
               className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all whitespace-nowrap
                 ${statusFilter === status ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
             >
               {status.replace('_', ' ')}
             </button>
           ))}
         </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex-1 flex flex-col min-h-[500px]">
          <div className="overflow-x-auto flex-1">
             <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-slate-50 border-b border-gray-200">
                   <tr>
                     <th className="px-5 py-3.5 text-left font-bold text-slate-500 tracking-wider text-[11px] uppercase">Document / Vendor</th>
                     <th className="px-5 py-3.5 text-left font-bold text-slate-500 tracking-wider text-[11px] uppercase cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleSort('date')}>
                        <div className="flex items-center gap-1">Date Scanned <ArrowUpDown className="h-3 w-3" /></div>
                     </th>
                     <th className="px-5 py-3.5 text-left font-bold text-slate-500 tracking-wider text-[11px] uppercase">Target Status</th>
                     <th className="px-5 py-3.5 text-left font-bold text-slate-500 tracking-wider text-[11px] uppercase cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleSort('confidence')}>
                        <div className="flex items-center gap-1">Confidence <ArrowUpDown className="h-3 w-3" /></div>
                     </th>
                     <th className="px-5 py-3.5 text-right font-bold text-slate-500 tracking-wider text-[11px] uppercase cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleSort('total')}>
                        <div className="flex flex-row-reverse items-center gap-1">Total (₹) <ArrowUpDown className="h-3 w-3" /></div>
                     </th>
                     <th className="px-5 py-3.5 text-right font-bold text-slate-500 tracking-wider text-[11px] uppercase">Actions</th>
                   </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                   {isLoading ? (
                     <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                           <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                           <span className="font-semibold text-sm">Loading invoices...</span>
                        </td>
                     </tr>
                   ) : currentChunk.length === 0 ? (
                     <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-gray-500 font-semibold text-sm">
                           No invoices match your current filter criteria.
                        </td>
                     </tr>
                   ) : currentChunk.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                         <td className="px-5 py-4">
                           <p className="font-bold text-gray-900 truncate max-w-[200px] text-[13px]">{inv.vendor_name || 'Missing Vendor'}</p>
                           <p className="text-xs font-medium text-gray-500 truncate max-w-[200px] mt-0.5">{inv.original_filename}</p>
                         </td>
                         <td className="px-5 py-4 text-gray-600 font-semibold whitespace-nowrap text-[13px]">
                            {formatDate(inv.created_at)}
                         </td>
                         <td className="px-5 py-4 whitespace-nowrap">
                            <StatusBadge status={inv.status} />
                         </td>
                         <td className="px-5 py-4 min-w-[150px]">
                            <ConfidenceBar score={inv.confidence_score} />
                         </td>
                         <td className="px-5 py-4 whitespace-nowrap text-right font-black text-gray-900 text-[13px]">
                            {formatCurrency(inv.total_amount)}
                         </td>
                         <td className="px-5 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                               <Link to={`/invoices/${inv.id}`}>
                                  <Button variant="outline" className="h-8 w-8 p-0 bg-white hover:bg-slate-100 text-slate-600 border-slate-200 shadow-sm" title="View details">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                               </Link>
                               <Button variant="outline" disabled={isDeleting} onClick={() => handleDelete(inv.id)} className="h-8 w-8 p-0 bg-white hover:bg-red-50 text-red-500 hover:text-red-700 hover:border-red-200 border-gray-200 shadow-sm" title="Erase Record">
                                 <Trash2 className="h-4 w-4" />
                               </Button>
                            </div>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>

          <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
             <span className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
               Showing <span className="font-black text-gray-900">{(page-1)*ITEMS_PER_PAGE + (currentChunk.length > 0 ? 1 : 0)}</span> <span className="text-gray-400">TO</span> <span className="font-black text-gray-900">{(page-1)*ITEMS_PER_PAGE + currentChunk.length}</span> <span className="text-gray-400">OF</span> <span className="font-black text-blue-600">{processedData.length}</span> Objects
             </span>
             <div className="flex gap-2">
               <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} variant="outline" className="h-8 bg-white shadow-sm font-semibold text-xs" size="sm">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
               </Button>
               <Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || totalPages === 0} variant="outline" className="h-8 bg-white shadow-sm font-semibold text-xs" size="sm">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
               </Button>
             </div>
          </div>
      </div>
    </div>
  );
};
