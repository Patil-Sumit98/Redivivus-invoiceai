import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Invoice } from '../types';

export const useInvoiceStatus = (invoiceId: string | undefined) => {
  return useQuery<Invoice>({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      const response = await apiClient.get(`/invoices/${invoiceId}`);
      return response.data;
    },
    enabled: !!invoiceId,
    refetchInterval: (query) => {
      const status = query.state.data?.status?.toUpperCase();
      if (!status || status === 'PROCESSING' || status === 'PENDING') {
        return 2000;
      }
      return false;
    },
  });
};