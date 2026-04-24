import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { InvoiceListItem, Stats } from '../types';

interface UseInvoiceListParams {
  skip?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export const useInvoiceList = (params: UseInvoiceListParams = {}) => {
  const { skip = 0, limit = 20, status, search } = params;

  return useQuery<{items: InvoiceListItem[], total: number}>({
    queryKey: ['invoices_list', skip, limit, status, search],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.set('skip', String(skip));
      queryParams.set('limit', String(limit));
      if (status && status !== 'All') queryParams.set('status', status);
      if (search && search.trim()) queryParams.set('search', search.trim());

      const response = await apiClient.get(`/invoices/?${queryParams.toString()}`);
      return response.data;
    },
  });
};

export const useDashboardStats = () => {
  return useQuery<Stats>({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const response = await apiClient.get('/invoices/stats');
      return response.data;
    },
  });
};

export const useDeleteInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices_list'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    }
  });
};