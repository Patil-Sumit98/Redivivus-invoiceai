import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { ReviewItem } from '../types';

export const useReviewQueue = () => {
  return useQuery<{items: ReviewItem[], total_pending: number}>({
    queryKey: ['review_queue'],
    queryFn: async () => {
      const response = await apiClient.get('/review/queue');
      return response.data;
    },
  });
};

export const useReviewSubmit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, corrected_data, notes }: { id: string, action: string, corrected_data?: any, notes?: string }) => {
      const response = await apiClient.post(`/review/${id}/submit`, {
        action,
        corrected_data,
        notes
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review_queue'] });
      queryClient.invalidateQueries({ queryKey: ['review_badge_count'] });
      queryClient.invalidateQueries({ queryKey: ['invoices_list'] });
      // NOTE: do NOT invalidate ['invoice'] here — that would regenerate the SAS URL
      // in the open modal, change the iframe src, and trigger another file download.
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    }
  });
};
