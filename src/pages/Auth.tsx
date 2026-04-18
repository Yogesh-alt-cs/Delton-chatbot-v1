import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
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
        toast({ title: 'ERROR', description: message, variant: 'destructive' });
      } else {
        if (!isLogin) {
          toast({ title: 'ACCOUNT CREATED', description: 'Welcome to Delton.' });
        }
        navigate('/chat', { replace: true });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — brutal terminal block */}
      <div className="hidden md:flex md:w-[45%] lg:w-1/2 brutal-border-r flex-col justify-between p-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 bg-foreground" />
            <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
              DELTON_CORE // V2.0.0
            </span>
          </div>
        </div>

        <div>
          <h1 className="font-display text-6xl lg:text-7xl leading-[0.9] mb-6">
            DELTON<br/>AI.
          </h1>
          <div className="brutal-border-t pt-6 max-w-md">
            <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase leading-relaxed">
              &gt; Intelligent assistant.<br/>
              &gt; Brutalist interface.<br/>
              &gt; Zero abstraction.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          <span>STATUS: ONLINE</span>
          <span>LATENCY: 12MS</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-reveal">
          {/* Mobile-only header */}
          <div className="mb-8 md:hidden">
            <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
              DELTON_CORE
            </span>
            <h1 className="font-display text-5xl mt-2">DELTON AI.</h1>
          </div>

          <div className="brutal-border-b pb-4 mb-8">
            <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
              {isLogin ? '> LOG_IN' : '> REGISTER'}
            </span>
            <h2 className="font-display text-3xl mt-2 uppercase">
              {isLogin ? 'Access Terminal' : 'Create Account'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
                &gt; Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="user@domain.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`auth-input w-full ${errors.email ? 'auth-input-error' : ''}`}
                disabled={isLoading}
                autoComplete="email"
              />
              {errors.email && (
                <p className="mt-2 font-mono text-[10px] tracking-wider text-destructive uppercase">
                  ! {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
                &gt; Password
              </label>
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
              {errors.password && (
                <p className="mt-2 font-mono text-[10px] tracking-wider text-destructive uppercase">
                  ! {errors.password}
                </p>
              )}
              {isLogin && (
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="mt-3 font-mono text-[10px] tracking-widest text-muted-foreground hover:text-foreground uppercase"
                >
                  &gt; Forgot password?
                </button>
              )}
            </div>

            <Button
              type="submit"
              className="btn-brutal h-12 w-full text-sm tracking-widest"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isLogin ? (
                '[ TRANSMIT ]'
              ) : (
                '[ INITIALIZE ]'
              )}
            </Button>
          </form>

          <div className="brutal-border-t mt-8 pt-6 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="font-mono text-[10px] tracking-widest text-muted-foreground hover:text-foreground uppercase text-left"
              disabled={isLoading}
            >
              {isLogin ? '> No account? CREATE_NEW' : '> Have account? SIGN_IN'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 font-mono text-[10px] tracking-widest text-muted-foreground hover:text-foreground uppercase"
            >
              <ArrowLeft className="h-3 w-3" />
              Return to root
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
