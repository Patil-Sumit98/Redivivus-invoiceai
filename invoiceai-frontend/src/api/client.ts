import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor — attach JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('invoiceai_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — BUG-22: centralized 401 handling
// Calls authStore.logout() which handles the redirect, instead of doing its own redirect.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Centralized: let the store handle cleanup + redirect
      useAuthStore.getState().logout();
    }
    // Don't show generic toast for 401 (logout handles it) or for errors
    // that the caller handles with their own onError
    return Promise.reject(error);
  }
);
