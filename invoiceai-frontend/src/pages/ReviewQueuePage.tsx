import { useState, useMemo } from 'react';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { ReviewModal } from '../components/ReviewModal';
import { StatusBadge } from '../components/StatusBadge';
import { formatTimeAgo } from '../utils/formatters';
import { AlertCircle, FileText, CheckCircle, Loader2 } from 'lucide-react';

export const ReviewQueuePage = () => {
  const { data, isLoading } = useReviewQueue();
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);

  // Sort HUMAN_REQUIRED before NEEDS_REVIEW
  const sortedItems = useMemo(() => {
    if (!data?.items) return [];
    return [...data.items].sort((a, b) => {
      const aIsHuman = a.status === 'HUMAN_REQUIRED';
      const bIsHuman = b.status === 'HUMAN_REQUIRED';
      if (aIsHuman && !bIsHuman) return -1;
      if (!aIsHuman && bIsHuman) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [data]);

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-ink-200 pb-5">
        <div>
           <h2 className="text-2xl font-bold tracking-tight text-ink-900">Review Queue</h2>
           <p className="text-sm font-medium text-ink-500 mt-1">Resolve flagged anomalies and human-in-the-loop checkpoints.</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border shadow-sm ${data?.total_pending && data.total_pending > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-green-50 border-green-200 text-green-900'}`}>
           {data?.total_pending && data.total_pending > 0 ? (
             <AlertCircle className="h-5 w-5 text-amber-600" />
           ) : (
             <CheckCircle className="h-5 w-5 text-green-600" />
           )}
           <span className="font-extrabold">{data?.total_pending || 0} Pending</span>
        </div>
      </div>

      <div className="grid gap-4">
         {isLoading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-4 text-center text-ink-500 font-semibold bg-white rounded-xl shadow-sm border border-ink-200">
               <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
               Fetching review queue...
            </div>
         ) : !sortedItems || sortedItems.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-ink-200 p-20 flex flex-col items-center justify-center gap-5">
               <div className="p-6 bg-green-50 rounded-full flex items-center justify-center shadow-inner">
                  <CheckCircle className="h-16 w-16 text-green-500" />
               </div>
               <div className="text-center">
                  <h3 className="text-2xl font-black text-ink-900 tracking-tight">Queue is clear</h3>
                  <p className="text-ink-500 font-medium text-sm mt-2">All invoices have been verified or are processing.</p>
               </div>
            </div>
         ) : (
            <div className="grid grid-cols-1 gap-4">
               {sortedItems.map(item => {
                  const isHumanRequired = item.status === 'HUMAN_REQUIRED';
                  const borderClass = isHumanRequired ? 'border-l-red-500' : 'border-l-amber-500';
                  
                  // Compute simple block confidence bar
                  const confVal = item.confidence_score !== null && item.confidence_score !== undefined ? Math.round(item.confidence_score * 100) : null;
                  let confColor = 'bg-ink-200';
                  if (confVal !== null) {
                    if (confVal >= 90) confColor = 'bg-green-500';
                    else if (confVal >= 60) confColor = 'bg-amber-500';
                    else confColor = 'bg-red-500';
                  }

                  const firstFewFlags = item.gst_flags?.slice(0, 2) || [];
                  const extraFlags = (item.gst_flags?.length || 0) - firstFewFlags.length;

                  return (
                    <div 
                      key={item.id}
                      onClick={() => setActiveReviewId(item.id)}
                      className={`relative bg-white rounded-xl shadow-sm border border-ink-200 border-l-[4px] ${borderClass} hover:border-ink-300 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer p-6 flex flex-col gap-5 group`}
                    >
                       {/* Top Row */}
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <StatusBadge status={item.status} />
                             <h4 className="font-bold text-ink-900 text-[15px] flex items-center gap-2">
                               <FileText className="h-4 w-4 text-ink-400" />
                               {item.original_filename}
                             </h4>
                          </div>
                          <span className="text-xs font-semibold text-ink-500 bg-ink-50 px-2.5 py-1 rounded-md">
                            {formatTimeAgo(item.created_at)}
                          </span>
                       </div>
                       
                       {/* Middle: Confidence & Flag Count */}
                       <div className="flex items-center gap-4 bg-ink-50/50 p-4 rounded-lg border border-ink-100">
                           <div className="flex-1 flex items-center gap-3">
                              <span className="text-[10px] font-bold text-ink-500 uppercase tracking-wider w-20 shrink-0">Confidence:</span>
                              <div className="flex-1 h-2 bg-ink-200 rounded-full overflow-hidden max-w-[200px]">
                                 {confVal !== null && (
                                   <div className={`h-full ${confColor}`} style={{ width: `${confVal}%` }} />
                                 )}
                              </div>
                              <span className="text-xs font-bold text-ink-900 w-8">{confVal !== null ? `${confVal}%` : '—'}</span>
                           </div>

                           <div className="hidden sm:flex items-center gap-2 border-l border-ink-200 pl-4">
                              <span className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">Flags:</span>
                              <span className="text-sm font-black text-ink-900">{item.gst_flags?.length || 0}</span>
                           </div>
                       </div>

                       {/* Bottom Row: Flags */}
                       {item.gst_flags && item.gst_flags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                             {firstFewFlags.map((flag, idx) => (
                               <div key={idx} className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                                  <AlertCircle className="h-3 w-3" />
                                  <span>{flag}</span>
                               </div>
                             ))}
                             {extraFlags > 0 && (
                               <span className="text-[11px] font-bold text-ink-500">+{extraFlags} more</span>
                             )}
                          </div>
                       )}

                    </div>
                  );
               })}
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