import { create } from 'zustand';

interface UserPayload {
  id: string;
  email: string;
}

interface AuthState {
  token: string | null;
  user: UserPayload | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserPayload) => void;
  logout: () => void;
  initFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  
  login: (token, user) => {
    localStorage.setItem('invoiceai_token', token);
    localStorage.setItem('invoiceai_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },
  
  logout: () => {
    localStorage.removeItem('invoiceai_token');
    localStorage.removeItem('invoiceai_user');
    set({ token: null, user: null, isAuthenticated: false });
    // Hard refresh/redirect
    if (window.location.pathname !== '/login') {
        window.location.href = '/login'; 
    }
  },
  
  initFromStorage: () => {
    const token = localStorage.getItem('invoiceai_token');
    const userStr = localStorage.getItem('invoiceai_user');
    let user = null;
    
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch (e) {
        // suppress
      }
    }
    
    set({
      token,
      user,
      isAuthenticated: !!token,
    });
  }
}));