import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { apiClient } from '../api/client';
import type { Invoice } from '../types';

/**
 * BUG-16: Polling hook with 10-minute timeout to prevent infinite polling
 * when invoices get stuck in "processing" status.
 */
export const useInvoiceStatus = (
  invoiceId: string | undefined,
  options?: { disablePolling?: boolean }
) => {
  const pollingStart = useRef<number | null>(null);

  const query = useQuery<Invoice>({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      const response = await apiClient.get(`/invoices/${invoiceId}`);
      return response.data;
    },
    enabled: !!invoiceId,
    refetchInterval: (q) => {
      if (options?.disablePolling) return false;
      const status = q.state.data?.status?.toUpperCase();

      if (!status || status === 'PROCESSING' || status === 'PENDING') {
        // Start tracking polling time
        if (!pollingStart.current) pollingStart.current = Date.now();

        const elapsed = Date.now() - pollingStart.current;
        // BUG-16: Stop polling after 10 minutes
        if (elapsed > 10 * 60 * 1000) return false;

        return 2000;
      }

      // Final status reached — reset timer
      pollingStart.current = null;
      return false;
    },
  });

  // BUG-16: Export timeout status for UI warning
  const isPollingTimedOut =
    pollingStart.current !== null &&
    Date.now() - pollingStart.current > 10 * 60 * 1000;

  return {
    ...query,
    isPollingTimedOut,
  };
};