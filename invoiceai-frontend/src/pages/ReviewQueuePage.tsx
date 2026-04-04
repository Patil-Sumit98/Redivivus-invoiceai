import { useState } from 'react';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { ReviewModal } from '../components/ReviewModal';
import { StatusBadge } from '../components/StatusBadge';
import { ConfidenceBar } from '../components/ConfidenceBar';
import { formatTimeAgo } from '../utils/formatters';
import { AlertCircle, FileText, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';

export const ReviewQueuePage = () => {
  const { data, isLoading } = useReviewQueue();
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full space-y-6 pb-20">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
           <h2 className="text-3xl font-bold tracking-tight text-gray-900">Human Review Terminal</h2>
           <p className="text-sm font-medium text-gray-500 mt-1">Review flagged invoices that need manual verification.</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200 shadow-sm">
           <AlertCircle className="h-5 w-5 text-amber-600" />
           <span className="font-extrabold text-amber-900">{data?.total_pending || 0} Pending Documents</span>
        </div>
      </div>

      <div className="grid gap-6">
         {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-4 text-center text-gray-500 font-semibold bg-white rounded-xl shadow-sm border border-gray-200">
               <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
               Fetching review queue...
            </div>
         ) : !data?.items || data.items.length === 0 ? (
            <Card className="shadow-sm border-0 ring-1 ring-gray-200 bg-white">
               <CardContent className="p-16 flex flex-col items-center justify-center gap-4">
                  <div className="p-5 bg-emerald-50 rounded-full">
                     <CheckCircle className="h-14 w-14 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mt-2">Review Queue Empty!</h3>
                  <p className="text-gray-500 font-semibold text-sm">All invoices have been reviewed successfully.</p>
               </CardContent>
            </Card>
         ) : (
            <div className="grid grid-cols-1 gap-4">
               {data.items.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => setActiveReviewId(item.id)}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 group"
                  >
                     <div className="flex items-start gap-4">
                         <div className="bg-slate-50 p-3.5 rounded-xl flex items-center justify-center ring-1 ring-slate-200 group-hover:bg-amber-50 group-hover:ring-amber-200 transition-colors shrink-0">
                             <FileText className="h-7 w-7 text-slate-400 group-hover:text-amber-600 transition-colors" />
                         </div>
                         <div className="flex flex-col gap-1.5">
                             <h4 className="font-bold text-gray-900 text-[15px] truncate max-w-sm">{item.original_filename}</h4>
                             <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{formatTimeAgo(item.created_at)}</p>
                         </div>
                     </div>
                     
                     <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 shrink-0 border-t sm:border-0 border-gray-100 pt-4 sm:pt-0">
                         <div className="flex flex-col items-start min-w-[200px]">
                            <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase mb-2">Engine Confidence Level</span>
                            <ConfidenceBar score={item.confidence_score} />
                         </div>
                         <div className="flex flex-col items-start min-w-[150px]">
                            <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase mb-2">Target Status</span>
                            <StatusBadge status={item.status} />
                         </div>
                         <div className="hidden lg:flex flex-col items-center justify-center bg-gray-50 px-5 py-2.5 rounded-lg border border-gray-100 shadow-inner">
                            <span className="text-2xl font-black text-gray-900 leading-none">{item.gst_flags?.length || 0}</span>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">GST Flags</span>
                         </div>
                         <button className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-amber-600 group-hover:border-amber-600 transition-all shadow-sm shrink-0 group-hover:scale-105">
                            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
                         </button>
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>

      {activeReviewId && (
         <ReviewModal 
           invoiceId={activeReviewId}
           onClose={() => setActiveReviewId(null)}
         />
      )}
    </div>
  );
};