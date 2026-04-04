import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Copy, Check, Download, Trash2, Plus, Loader2, Settings, Globe, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';

export const SettingsPage = () => {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookSecret, setNewWebhookSecret] = useState('');

  // Webhooks
  const { data: webhooks, isLoading: loadingHooks } = useQuery<any[]>({
    queryKey: ['webhooks'],
    queryFn: async () => { const r = await apiClient.get('/webhooks'); return r.data; },
  });

  const createHook = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/webhooks', {
        url: newWebhookUrl,
        events: ['invoice.completed'],
        secret: newWebhookSecret || 'default-secret',
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setNewWebhookUrl('');
      setNewWebhookSecret('');
      toast.success('Webhook registered!');
    },
    onError: () => toast.error('Failed to register webhook.'),
  });

  const deleteHook = useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/webhooks/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook removed.');
    },
  });

  const handleCopyApiKey = () => {
    // API key from authStore user — for now just show email as identifier
    navigator.clipboard.writeText(user?.email || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const res = await apiClient.get(`/invoices/export/${format}`, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} downloaded!`);
    } catch {
      toast.error(`Export failed.`);
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-4xl">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
          <Settings className="h-7 w-7 text-blue-600" /> Settings
        </h2>
        <p className="text-sm font-medium text-gray-500 mt-1">Manage account, webhooks, and data exports.</p>
      </div>

      {/* Section 1: Account */}
      <Card className="shadow-sm border-0 ring-1 ring-gray-200 bg-white">
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="text-lg">My Account</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email</p>
              <p className="font-semibold text-gray-900 mt-1">{user?.email || 'N/A'}</p>
            </div>
            <Button onClick={handleCopyApiKey} variant="outline" className="bg-white shadow-sm font-semibold text-xs">
              {copied ? <Check className="h-4 w-4 mr-1 text-emerald-500" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">User ID</p>
              <p className="font-mono text-sm text-gray-700 mt-1">{user?.id || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Webhooks */}
      <Card className="shadow-sm border-0 ring-1 ring-gray-200 bg-white">
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="text-lg flex items-center gap-2"><Globe className="h-5 w-5 text-indigo-600" /> Webhooks</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input as="input" placeholder="https://your-api.com/webhook" value={newWebhookUrl} onChange={(e: any) => setNewWebhookUrl(e.target.value)} className="flex-1" />
            <Input as="input" placeholder="Secret" value={newWebhookSecret} onChange={(e: any) => setNewWebhookSecret(e.target.value)} className="w-full sm:w-48" />
            <Button onClick={() => createHook.mutate()} disabled={!newWebhookUrl || createHook.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-bold whitespace-nowrap">
              {createHook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add</>}
            </Button>
          </div>

          {loadingHooks ? (
            <div className="text-center py-6 text-gray-400 font-medium"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : !webhooks?.length ? (
            <p className="text-sm text-gray-500 text-center py-4">No webhooks configured.</p>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
              {webhooks.map((hook: any) => (
                <div key={hook.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="truncate flex-1 mr-4">
                    <p className="font-semibold text-gray-900 text-sm truncate">{hook.url}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Events: {(hook.events || []).join(', ')}</p>
                  </div>
                  <Button variant="outline" onClick={() => deleteHook.mutate(hook.id)} disabled={deleteHook.isPending} className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 border-gray-200 shadow-sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Export */}
      <Card className="shadow-sm border-0 ring-1 ring-gray-200 bg-white">
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="text-lg flex items-center gap-2"><FileDown className="h-5 w-5 text-emerald-600" /> Export Data</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-gray-500 mb-4">Download all your invoice data for external analysis or reporting.</p>
          <div className="flex gap-4">
            <Button onClick={() => handleExport('csv')} variant="outline" className="bg-white shadow-sm font-bold flex items-center gap-2">
              <Download className="h-4 w-4" /> Export as CSV
            </Button>
            <Button onClick={() => handleExport('xlsx')} variant="outline" className="bg-white shadow-sm font-bold flex items-center gap-2">
              <Download className="h-4 w-4" /> Export as Excel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
