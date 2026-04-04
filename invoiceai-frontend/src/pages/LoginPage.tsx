import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
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
      // Backend returns user object — but guard against older tokens that may not have it
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-0 bg-white">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold text-gray-900 tracking-tight">InvoiceAI</CardTitle>
          <p className="text-sm text-gray-500">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email address</label>
              <Input
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Password</label>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                className="w-full"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
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
          
          <div className="mt-6 text-center text-sm">
            <span className="text-gray-500">Don't have an account? </span>
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};