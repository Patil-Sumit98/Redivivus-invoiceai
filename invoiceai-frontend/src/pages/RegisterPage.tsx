import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-0 bg-white">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold text-gray-900 tracking-tight">Create an account</CardTitle>
          <p className="text-sm text-gray-500">Sign up to get started securely.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email address</label>
              <Input
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required
                className="w-full"
              />
              {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                className="w-full"
              />
              {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Confirm Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                required
                className="w-full"
              />
              {fieldErrors.confirmPassword && <p className="text-xs text-red-500">{fieldErrors.confirmPassword}</p>}
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4" 
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
          
          <div className="mt-6 text-center text-sm">
            <span className="text-gray-500">Already have an account? </span>
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};