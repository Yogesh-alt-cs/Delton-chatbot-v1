import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        setSent(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <motion.div
        className="w-full max-w-sm"
        initial="hidden"
        animate="show"
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.12 } } }}
      >
        <motion.div variants={fadeUp} className="mb-8">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-center">Reset Password</h1>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            {sent
              ? 'Check your email for a password reset link.'
              : 'Enter your email and we\'ll send you a reset link.'}
          </p>
        </motion.div>

        {!sent ? (
          <motion.form variants={fadeUp} onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </Label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input w-full"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <Button type="submit" className="h-11 w-full text-base font-semibold auth-btn-shimmer" disabled={isLoading || !email.trim()}>
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send Reset Link'}
            </Button>
          </motion.form>
        ) : (
          <motion.div variants={fadeUp} className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              If an account exists for <strong className="text-foreground">{email}</strong>, you'll receive a reset link shortly.
            </p>
          </motion.div>
        )}

        <motion.div variants={fadeUp} className="mt-8 text-center">
          <button
            type="button"
            onClick={() => navigate('/auth?mode=login')}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
