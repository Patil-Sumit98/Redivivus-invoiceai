import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvoiceStatus } from '../hooks/useInvoiceStatus';
import { ConfidenceBar } from '../components/ConfidenceBar';
import { StatusBadge } from '../components/StatusBadge';
import { GSTRulesPanel } from '../components/GSTRulesPanel';
import { LineItemsTable } from '../components/LineItemsTable';
import { formatDate, formatCurrency } from '../utils/formatters';
import { Card, CardContent } from '../components/ui/card';
import { AlertTriangle, Copy, Check, FileText, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export const InvoiceDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading, error } = useInvoiceStatus(id);
  const [activeTab, setActiveTab] = useState<'data' | 'gst' | 'items' | 'json'>('data');
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return <div className="flex h-[50vh] items-center justify-center text-gray-500 font-medium">Loading invoice details...</div>;
  }

  if (error || !invoice) {
    return <div className="flex h-[50vh] items-center justify-center text-red-500 font-medium">Failed to load invoice details.</div>;
  }

  // Fix #21: Backend returns both "data" and "data_json" — use whichever is available
  const data = invoice.data_json || (invoice as any).data;
  // GST rules may be nested inside data or at invoice top level
  const gstRulesJson = (invoice as any).gst_rules_json || data?.gst_rules_json;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(invoice, null, 2));
    setCopied(true);
    toast.success('Raw JSON copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const renderField = (label: string, field: any, isCurrency = false) => {
    const isLowConfidence = field?.confidence !== undefined && field.confidence < 0.60;
    const valueStr = isCurrency ? formatCurrency(field?.value) : (field?.value || '-');
    return (
      <div className={`p-3 rounded-md transition-colors ${isLowConfidence ? 'bg-red-50 ring-1 ring-red-200 shadow-sm' : 'bg-gray-50'}`}>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <p className={`font-semibold mt-1 mb-2 ${isLowConfidence ? 'text-red-900' : 'text-gray-900'}`}>{valueStr}</p>
        <ConfidenceBar score={field?.confidence} />
      </div>
    );
  };

  const isReviewNeeded = ['NEEDS_REVIEW', 'HUMAN_REQUIRED'].includes(invoice.status?.toUpperCase() || '');
  const fileUrl = invoice.file_url && invoice.file_url.startsWith('http') ? invoice.file_url : `http://localhost:8000${invoice.file_url}`;
  const isPDF = invoice.original_filename?.toLowerCase().endsWith('.pdf');

  return (
    <div className="flex flex-col h-full space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <FileText className="text-blue-600 h-6 w-6 shrink-0" />
            <span className="truncate max-w-sm md:max-w-xl">{invoice.original_filename}</span>
          </h2>
          <p className="text-sm font-medium text-gray-500 mt-1 ml-9">Uploaded {formatDate(invoice.created_at)}</p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full min-h-[700px]">
        {/* Left Column: Original File (iframe or img) */}
        <Card className="shadow-sm border-0 ring-1 ring-gray-200 overflow-hidden flex flex-col bg-white">
          <div className="bg-slate-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm z-10">
            <h3 className="font-semibold text-sm text-gray-700 tracking-tight">Original Document Source</h3>
          </div>
          <CardContent className="p-0 flex-1 bg-gray-100/50 flex items-center justify-center min-h-[500px] lg:min-h-[700px]">
             {isPDF ? (
               <iframe src={fileUrl} className="w-full h-full min-h-[700px] border-0" title="PDF Viewer" />
             ) : (
               <div className="w-full h-full overflow-auto p-4 flex items-center justify-center">
                 <img src={fileUrl} alt="Invoice Document" className="max-w-full max-h-[800px] object-contain shadow-sm ring-1 ring-gray-200 rounded-sm bg-white" />
               </div>
             )}
          </CardContent>
        </Card>

        {/* Right Column: Extracted Values */}
        <div className="flex flex-col gap-4">
          
          {/* Custom Native Tailwind Tabs */}
          <div className="flex space-x-1 bg-slate-200/60 p-1 rounded-lg shrink-0">
            {(['data', 'gst', 'items', 'json'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-all
                  ${activeTab === tab ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/50' : 'text-gray-600 hover:text-gray-900 hover:bg-slate-300/40'}`}
              >
                {tab === 'data' && 'Invoice Data'}
                {tab === 'gst' && 'GST Validation'}
                {tab === 'items' && 'Line Items'}
                {tab === 'json' && 'Raw JSON'}
              </button>
            ))}
          </div>

          <Card className="shadow-sm border-0 ring-1 ring-gray-200 flex-1 overflow-hidden flex flex-col bg-white">
             <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
                
                {/* Tab: DATA */}
                {activeTab === 'data' && (
                  <div className="p-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                       <h3 className="text-lg font-bold tracking-tight text-gray-900">Extracted Key Values</h3>
                       <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${data?.metadata?.ingestion_method === 'QR' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                          {data?.metadata?.ingestion_method === 'QR' ? 'QR Code Scanned' : 'Azure AI Visually Parsed'}
                       </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="sm:col-span-2">{renderField('Vendor Name', data?.vendor_name)}</div>
                       {renderField('Vendor GSTIN', data?.vendor_gstin)}
                       {renderField('Buyer GSTIN', data?.buyer_gstin)}
                       {renderField('Invoice Number', data?.invoice_number)}
                       {renderField('Invoice Date', data?.invoice_date)}
                       
                       <div className="sm:col-span-2 border-t border-gray-200 pt-6 mt-4">
                           <h4 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-widest">Calculated Subtotals</h4>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                             {renderField('Subtotal', data?.subtotal, true)}
                             {renderField('CGST', data?.cgst, true)}
                             {renderField('SGST', data?.sgst, true)}
                             {renderField('IGST', data?.igst, true)}
                           </div>
                       </div>
                       <div className="sm:col-span-2 mt-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                         {renderField('Total Amount', data?.total_amount, true)}
                       </div>
                    </div>
                  </div>
                )}

                {/* Tab: GST */}
                {activeTab === 'gst' && (
                  <div className="p-6 animate-in fade-in duration-300">
                    <h3 className="text-lg font-bold tracking-tight text-gray-900 mb-6 pb-4 border-b border-gray-100">Automated Ruleset Execution</h3>
                    <GSTRulesPanel gstData={gstRulesJson} />
                  </div>
                )}

                {/* Tab: ITEMS */}
                {activeTab === 'items' && (
                  <div className="p-6 animate-in fade-in duration-300">
                    <h3 className="text-lg font-bold tracking-tight text-gray-900 mb-6 pb-4 border-b border-gray-100">Parsed Line Items</h3>
                    <LineItemsTable items={data?.line_items} />
                  </div>
                )}

                {/* Tab: JSON */}
                {activeTab === 'json' && (
                  <div className="p-6 animate-in fade-in duration-300 relative group h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4 shrink-0">
                       <h3 className="text-lg font-bold tracking-tight text-gray-900">Developer Payload</h3>
                       <button 
                         onClick={handleCopyJson}
                         className="flex items-center gap-2 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-md transition-colors shadow-sm"
                       >
                         {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                         {copied ? 'Payload Copied!' : 'Copy Schema'}
                       </button>
                    </div>
                    <div className="bg-slate-950 text-emerald-400 p-5 rounded-lg overflow-auto text-[13px] font-mono flex-1 shadow-inner ring-1 ring-slate-800">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(invoice, null, 2)}</pre>
                    </div>
                  </div>
                )}

             </CardContent>
          </Card>
        </div>
      </div>

      {/* Review Banner Alert */}
      {isReviewNeeded && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:left-64">
           <div className="bg-amber-50 border-t-4 border-amber-400 text-amber-900 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl backdrop-blur-md">
             <div className="flex items-center gap-4">
                <div className="bg-amber-100 p-3 rounded-full shrink-0">
                    <AlertTriangle className="h-7 w-7 text-amber-600" />
                </div>
                <div>
                   <h4 className="font-extrabold text-lg tracking-tight">Manual Review Required</h4>
                   <p className="text-sm font-medium text-amber-700/80 mt-0.5 max-w-2xl">This invoice requires human intervention due to low-confidence values or failed GST validation flags mathematically.</p>
                </div>
             </div>
             <button 
                onClick={() => navigate('/review-queue')}
                className="whitespace-nowrap shrink-0 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg w-full sm:w-auto"
             >
                Open Review Terminal <ArrowRight className="h-5 w-5" />
             </button>
           </div>
        </div>
      )}

    </div>
  );
};