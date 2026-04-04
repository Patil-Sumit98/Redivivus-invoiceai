
import { useUploadInvoice } from '../hooks/useUploadInvoice';
import { FileDropzone } from '../components/FileDropzone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { FileSearch, Sparkles, ServerCog } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { InvoiceListItem } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate } from '../utils/formatters';

export const UploadPage = () => {
  const { mutate: uploadInvoice, isPending } = useUploadInvoice();

  const handleUpload = (file: File) => {
    uploadInvoice(file);
  };

  const { data: recentInvoices } = useQuery<{items: InvoiceListItem[]}>({
    queryKey: ['invoices', { limit: 5 }],
    queryFn: async () => {
      const res = await apiClient.get('/invoices/?limit=5');
      return res.data;
    }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
      
      {/* Upload Column */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Upload Invoice</h2>
          <p className="text-gray-500">Securely ingest PDFs or images for intelligent processing.</p>
        </div>

        <Card className="shadow-sm border-0 ring-1 ring-gray-200 overflow-hidden">
          <CardContent className="p-0 bg-slate-50/50">
            <FileDropzone onUpload={handleUpload} isUploading={isPending} />
          </CardContent>
        </Card>

        {/* Recent Uploads block */}
        <Card className="shadow-sm border-0 ring-1 ring-gray-200 mt-8">
          <CardHeader className="border-b border-gray-100 pb-4">
            <CardTitle className="text-lg">Recent Uploads</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!recentInvoices?.items?.length ? (
              <div className="p-6 text-center text-gray-500 text-sm">No recent uploads.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentInvoices.items.map((inv: InvoiceListItem) => (
                  <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <span className="font-medium text-gray-900 truncate max-w-[200px] sm:max-w-xs">{inv.original_filename}</span>
                      <span className="text-xs text-gray-500">{formatDate(inv.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-sm font-semibold text-gray-700 hidden sm:block">
                        {formatCurrency(inv.total_amount)}
                      </span>
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Column */}
      <div className="lg:col-span-1 space-y-6 lg:mt-14">
        <Card className="shadow-sm border-0 ring-1 ring-gray-200 bg-gradient-to-b from-white to-slate-50">
          <CardHeader>
            <CardTitle className="text-lg">How it works</CardTitle>
            <CardDescription>InvoiceAI processes documents in real-time securely.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <FileSearch className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="font-semibold text-gray-900">QR Detection</h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  First, we scan for standard e-Invoice QR codes ensuring 100% data extraction without hallucination risks.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <ServerCog className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="font-semibold text-gray-900">Azure AI Processing</h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Fallback items undergo Microsoft Document Intelligence extraction for advanced OCR matching.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="font-semibold text-gray-900">Confidence Routing</h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Invoices below confidence thresholds are natively paused and pushed directly into your Review Queue for human validation.
                </p>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>

    </div>
  );
};