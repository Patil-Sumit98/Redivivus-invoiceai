import { useState, useEffect } from 'react';
import { useInvoiceStatus } from '../hooks/useInvoiceStatus';
import { useReviewSubmit } from '../hooks/useReviewQueue';
import { X, Loader2, Save, CheckCircle, AlertTriangle } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import toast from 'react-hot-toast';

export const ReviewModal = ({ invoiceId, onClose }: { invoiceId: string, onClose: () => void }) => {
  const { data: invoice, isLoading } = useInvoiceStatus(invoiceId);
  const { mutate: submitReview, isPending } = useReviewSubmit();

  const [formData, setFormData] = useState<any>({});
  const [notes, setNotes] = useState('');

  // Hydrate states when invoice lands
  // Use data_json or fallback to data key from backend
  const invoiceData = invoice?.data_json || (invoice as any)?.data;

  useEffect(() => {
    if (invoiceData) {
       setFormData({
         vendor_name: invoiceData.vendor_name?.value || '',
         vendor_gstin: invoiceData.vendor_gstin?.value || '',
         invoice_number: invoiceData.invoice_number?.value || '',
         invoice_date: invoiceData.invoice_date?.value || '',
         total_amount: invoiceData.total_amount?.value || '',
         cgst: invoiceData.cgst?.value || '',
         sgst: invoiceData.sgst?.value || '',
         igst: invoiceData.igst?.value || '',
       });
    }
  }, [invoiceData]);

  const handleChange = (k: string, val: string) => setFormData((p: any) => ({ ...p, [k]: val }));

  const handleSubmit = (action: 'APPROVED' | 'EDITED' | 'REJECTED') => {
     let corrected_data: any = undefined;
     if (action === 'EDITED') {
        const gstFormatStr = String(formData.vendor_gstin).trim();
        if (gstFormatStr && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstFormatStr)) {
           toast.error('Invalid GSTIN format. Expected: 22AAAAA0000A1Z5');
           return;
        }
        // Backend compute_confidence expects {value, confidence} dict format per field
        const wrap = (val: any, isNum = false) => ({
          value: val === '' ? null : (isNum ? Number(val) : val),
          confidence: 1.0
        });
        corrected_data = {
          vendor_name: wrap(formData.vendor_name),
          vendor_gstin: wrap(formData.vendor_gstin),
          invoice_number: wrap(formData.invoice_number),
          invoice_date: wrap(formData.invoice_date),
          total_amount: wrap(formData.total_amount, true),
          cgst: wrap(formData.cgst, true),
          sgst: wrap(formData.sgst, true),
          igst: wrap(formData.igst, true),
        };
     }

     submitReview({ id: invoiceId, action, notes, corrected_data }, {
        onSuccess: () => {
           toast.success(`Invoice successfully handled (${action}).`);
           onClose();
        },
        onError: () => toast.error(`Failed to submit human override manually.`)
     });
  };

  if (isLoading || !invoice) {
     return (
       <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
         <div className="bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            <p className="text-gray-600 font-semibold">Pulling document constraints...</p>
         </div>
       </div>
     );
  }

  const fileUrl = invoice.file_url?.startsWith('http') ? invoice.file_url : `http://localhost:8000${invoice.file_url}`;
  const isPDF = invoice.original_filename?.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 fade-in animate-in">
       <div className="bg-white w-full h-full xl:max-w-[1600px] xl:max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ring-1 ring-gray-900/10">
          
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50 shrink-0 rounded-t-2xl">
             <div className="flex flex-col">
                <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                   <AlertTriangle className="h-5 w-5 text-amber-600" /> Human Override Required
                </h2>
                <p className="text-sm font-medium text-gray-500 mt-0.5">{invoice.original_filename}</p>
             </div>
             <button onClick={onClose} className="p-2 bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors border border-gray-200 shadow-sm">
                <X className="h-5 w-5" />
             </button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
             
             {/* Left Panel - File */}
             <div className="flex-1 border-b lg:border-b-0 lg:border-r border-gray-100 bg-slate-100 p-4 lg:p-6 flex flex-col min-h-0 overflow-auto items-center justify-center">
                 {isPDF ? (
                   <iframe src={fileUrl} className="w-full h-full min-h-[500px] rounded-lg shadow-sm border border-gray-200 bg-white" title="PDF Source" />
                 ) : (
                   <img src={fileUrl} alt="Source Document" className="max-w-full max-h-full object-contain rounded-xl shadow-sm bg-white" />
                 )}
             </div>

             {/* Right Panel - Form */}
             <div className="w-full lg:w-[500px] xl:w-[600px] flex flex-col bg-white overflow-hidden shrink-0">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                   
                   <div>
                       <h3 className="text-sm font-bold tracking-wider text-gray-400 uppercase mb-4">Entity Parameters</h3>
                       <div className="space-y-4">
                          <div>
                             <label className="block text-xs font-semibold text-gray-700 mb-1">Vendor Name</label>
                             <Input as="input" value={formData.vendor_name} onChange={(e: any) => handleChange('vendor_name', e.target.value)} />
                          </div>
                          <div>
                             <label className="block text-xs font-semibold text-gray-700 mb-1">Vendor GSTIN</label>
                             <Input as="input" value={formData.vendor_gstin} onChange={(e: any) => handleChange('vendor_gstin', e.target.value)} placeholder="00XXXXX0000X0X0" />
                          </div>
                          <div>
                             <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Number</label>
                             <Input as="input" value={formData.invoice_number} onChange={(e: any) => handleChange('invoice_number', e.target.value)} />
                          </div>
                          <div>
                             <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Date</label>
                             <Input as="input" type="date" value={formData.invoice_date} onChange={(e: any) => handleChange('invoice_date', e.target.value)} />
                          </div>
                       </div>
                   </div>

                   <div className="pt-6 border-t border-gray-100">
                        <h3 className="text-sm font-bold tracking-wider text-gray-400 uppercase mb-4">Financial Values</h3>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="col-span-2">
                              <label className="block text-xs font-bold text-gray-700 mb-1">Total Amount (₹)</label>
                              <Input as="input" type="number" step="0.01" value={formData.total_amount} onChange={(e: any) => handleChange('total_amount', e.target.value)} />
                           </div>
                           <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">CGST (₹)</label>
                              <Input as="input" type="number" step="0.01" value={formData.cgst} onChange={(e: any) => handleChange('cgst', e.target.value)} />
                           </div>
                           <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1">SGST (₹)</label>
                              <Input as="input" type="number" step="0.01" value={formData.sgst} onChange={(e: any) => handleChange('sgst', e.target.value)} />
                           </div>
                           <div className="col-span-2">
                              <label className="block text-xs font-semibold text-gray-700 mb-1">IGST (₹)</label>
                              <Input as="input" type="number" step="0.01" value={formData.igst} onChange={(e: any) => handleChange('igst', e.target.value)} />
                           </div>
                       </div>
                   </div>

                   {(() => {
                     const gstRules = (invoice as any)?.data_json?.gst_rules_json || (invoice as any)?.data?.gst_rules_json;
                     const flags = gstRules?.flags;
                     return flags && flags.length > 0 ? (
                      <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-100 space-y-2">
                         <h4 className="text-xs font-bold uppercase text-red-800 tracking-wider flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> GST Compliance Flags</h4>
                         <ul className="text-xs text-red-700 list-disc pl-4 space-y-1 font-medium">
                            {flags.map((fl: string, i: number) => (
                               <li key={i}>{fl}</li>
                            ))}
                         </ul>
                      </div>
                    ) : null;
                   })()}

                   <div className="pt-6 border-t border-gray-100">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Optional Auditor Context (Notes)</label>
                      <textarea 
                         className="w-full text-sm border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 py-2 px-3 shadow-sm border"
                         rows={2}
                         value={notes} 
                         onChange={e => setNotes(e.target.value)} 
                         placeholder="Explain overrides or human reasoning..." 
                      />
                   </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-gray-200 grid grid-cols-2 gap-3 shrink-0 rounded-br-2xl">
                    <Button 
                       disabled={isPending} 
                       onClick={() => handleSubmit('REJECTED')}
                       className="bg-white text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 col-span-2 shadow-sm font-bold border"
                    >
                       Reject Extracted Payload
                    </Button>
                    <Button 
                       className="bg-amber-600 hover:bg-amber-700 text-white shadow-md font-bold"
                       disabled={isPending} 
                       onClick={() => handleSubmit('EDITED')}
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : <><Save className="h-4 w-4 mr-2" /> Save Form Edits</>}
                    </Button>
                    <Button 
                       className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-bold flex items-center justify-center gap-2"
                       disabled={isPending} 
                       onClick={() => handleSubmit('APPROVED')}
                    >
                      <CheckCircle className="h-4 w-4" /> Approve As-Is
                    </Button>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};
