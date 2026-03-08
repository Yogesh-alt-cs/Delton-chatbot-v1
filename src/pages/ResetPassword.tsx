import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Also check hash for type=recovery
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match.', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Password Updated', description: 'You can now sign in with your new password.' });
        navigate('/chat', { replace: true });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Invalid or expired reset link.</p>
          <Button variant="outline" onClick={() => navigate('/auth?mode=login')}>Back to Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8 text-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Set New Password</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New Password</Label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="auth-input w-full"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Confirm Password</Label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="auth-input w-full"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Update Password'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
