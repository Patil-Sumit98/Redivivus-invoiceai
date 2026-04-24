import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';

export const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  
  const navigate = useNavigate();
  const loginAction = useAuthStore((state) => state.login);

  const registerMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/register', { email, password });
      
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      
      const loginRes = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      return loginRes.data;
    },
    onSuccess: (data) => {
      loginAction(data.access_token, data.user);
      toast.success('Registration complete!');
      navigate('/dashboard');
    },
    onError: (error: any) => {
       const msg = error?.response?.data?.detail || 'Registration failed.';
       toast.error(msg);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    const errs: {[key: string]: string} = {};
    
    if (!email.includes('@')) {
      errs.email = "Invalid email formatting.";
    }
    if (password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }
    if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }
    
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    
    registerMutation.mutate();
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
          <h2 className="text-2xl font-bold text-ink-900 tracking-tight">Create an account</h2>
          <p className="mt-2 text-sm text-ink-500">Sign up to get started securely.</p>

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
              {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-ink-700">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                className="w-full h-11 border-ink-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg outline-none transition-all"
              />
              {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-ink-700">Confirm Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                required
                className="w-full h-11 border-ink-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg outline-none transition-all"
              />
              {fieldErrors.confirmPassword && <p className="text-xs text-red-500">{fieldErrors.confirmPassword}</p>}
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-lg font-semibold transition-colors mt-2" 
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-ink-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};