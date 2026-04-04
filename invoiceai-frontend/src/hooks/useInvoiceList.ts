import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { InvoiceListItem, Stats } from '../types';

export const useInvoiceList = (limit: number = 1000) => {
  return useQuery<{items: InvoiceListItem[], total: number}>({
    queryKey: ['invoices_list', limit],
    queryFn: async () => {
      const response = await apiClient.get(`/invoices/?limit=${limit}`);
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