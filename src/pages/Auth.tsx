import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageSquare, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const navigate = useNavigate();
  const { signIn, signUp, user, loading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      navigate('/chat', { replace: true });
    }
  }, [user, loading, navigate]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: { email?: string; password?: string } = {};
        err.errors.forEach((e) => {
          if (e.path[0] === 'email') newErrors.email = e.message;
          if (e.path[0] === 'password') newErrors.password = e.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      const { error } = isLogin
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        let message = error.message;
        if (error.message.includes('User already registered')) {
          message = 'This email is already registered. Please sign in instead.';
        } else if (error.message.includes('Invalid login credentials')) {
          message = 'Invalid email or password. Please try again.';
        }
        toast({ title: 'Error', description: message, variant: 'destructive' });
      } else {
        if (!isLogin) {
          toast({ title: 'Account created!', description: 'Welcome to Delton. You can now start chatting.' });
        }
        navigate('/chat', { replace: true });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stagger = {
    hidden: { opacity: 0 as number },
    show: { opacity: 1 as number, transition: { staggerChildren: 0.12 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — branded gradient */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center auth-gradient-bg">
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-primary/20"
              style={{
                width: 80 + i * 40,
                height: 80 + i * 40,
                left: `${15 + i * 12}%`,
                top: `${10 + i * 14}%`,
              }}
              animate={{
                y: [0, -20, 0],
                x: [0, 10, 0],
                scale: [1, 1.05, 1],
                opacity: [0.15, 0.3, 0.15],
              }}
              transition={{ duration: 6 + i * 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center px-12 max-w-lg">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/30"
          >
            <MessageSquare className="h-10 w-10 text-primary-foreground" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-4xl font-bold text-foreground mb-3"
          >
            Delton AI
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
            className="text-lg text-muted-foreground"
          >
            Your intelligent AI assistant — answers, analysis, and creative help, instantly.
          </motion.p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <motion.div
          className="w-full max-w-sm"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {/* Mobile logo */}
          <motion.div variants={fadeUp} className="mb-8 flex flex-col items-center lg:hidden">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25">
              <MessageSquare className="h-8 w-8 text-primary-foreground" />
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <h1 className="text-2xl font-bold text-foreground">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLogin ? 'Sign in to continue to Delton' : 'Sign up to start chatting with AI'}
            </p>
          </motion.div>

          <motion.form variants={fadeUp} onSubmit={handleSubmit} className="mt-8 space-y-5">
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
                className={`auth-input w-full ${errors.email ? 'auth-input-error' : ''}`}
                disabled={isLoading}
                autoComplete="email"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Password
              </Label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`auth-input w-full ${errors.password ? 'auth-input-error' : ''}`}
                disabled={isLoading}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              {isLogin && (
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                >
                  Forgot Password?
                </button>
              )}
            </div>

            <motion.div variants={fadeUp}>
              <Button
                type="submit"
                className="h-11 w-full text-base font-semibold auth-btn-shimmer"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isLogin ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </Button>
            </motion.div>
          </motion.form>

          <motion.div variants={fadeUp} className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={isLoading}
            >
              {isLogin ? (
                <>Don't have an account?{' '}<span className="font-semibold text-primary">Sign up</span></>
              ) : (
                <>Already have an account?{' '}<span className="font-semibold text-primary">Sign in</span></>
              )}
            </button>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-8 text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
