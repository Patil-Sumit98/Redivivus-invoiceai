import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const loginAction = useAuthStore((state) => state.login);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      
      const response = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return response.data;
    },
    onSuccess: async (data) => {
      let user = data.user;
      if (!user) {
        try {
          const meRes = await apiClient.get('/auth/me', {
            headers: { Authorization: `Bearer ${data.access_token}` }
          });
          user = { id: meRes.data.id, email: meRes.data.email };
        } catch {
          user = { id: 'unknown', email };
        }
      }
      loginAction(data.access_token, user);
      toast.success('Logged in successfully!');
      navigate('/dashboard');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.detail || 'Login failed. Check your credentials.';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="flex min-h-screen bg-white font-sans">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-1/2 bg-ink-950 flex-col justify-between p-12 lg:p-24 text-white">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">InvoiceAI</h1>
          <p className="mt-4 text-lg text-ink-300 max-w-md">
            Intelligent invoice processing for Indian GST compliance
          </p>
          
          <ul className="mt-12 space-y-4">
            <li className="flex items-center gap-3 text-ink-200">
              <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0" />
              <span>QR code detection for e-Invoices</span>
            </li>
            <li className="flex items-center gap-3 text-ink-200">
              <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0" />
              <span>Azure AI OCR with confidence scoring</span>
            </li>
            <li className="flex items-center gap-3 text-ink-200">
              <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0" />
              <span>Automated GST validation rules</span>
            </li>
          </ul>
        </div>
        <div className="text-sm text-ink-500">
          Trusted by finance teams across India
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-ink-900 tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-ink-500">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-ink-700">Email address</label>
              <Input
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required
                className="w-full h-11 border-ink-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-ink-700">Password</label>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                className="w-full h-11 border-ink-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg outline-none transition-all"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-lg font-semibold transition-colors mt-2" 
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-ink-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};