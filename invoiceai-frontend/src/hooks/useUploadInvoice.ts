import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';

export const useUploadInvoice = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      // Generate UUIDv4 natively
      const idempotencyKey = crypto.randomUUID();

      const response = await apiClient.post('/invoices/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Idempotency-Key': idempotencyKey,
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data && data.id) {
        toast.success('Invoice uploaded successfully!');
        navigate(`/invoices/${data.id}`);
      }
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.detail || 'Upload failed. Please try again.';
      toast.error(msg);
    },
  });
};