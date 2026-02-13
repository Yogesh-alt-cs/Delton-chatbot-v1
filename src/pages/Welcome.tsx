import { useNavigate } from 'react-router-dom';
import { MessageSquare, Sparkles, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
const features = [{
  icon: Sparkles,
  title: 'AI-Powered',
  description: 'Get intelligent responses to any question'
}, {
  icon: Zap,
  title: 'Instant Replies',
  description: 'Real-time streaming for fast conversations'
}, {
  icon: Shield,
  title: 'Secure & Private',
  description: 'Your conversations are encrypted and safe'
}];
export default function Welcome() {
  const navigate = useNavigate();
  const {
    user,
    loading
  } = useAuth();
  useEffect(() => {
    if (!loading && user) {
      navigate('/chat', {
        replace: true
      });
    }
  }, [user, loading, navigate]);
  return <div className="flex min-h-screen flex-col bg-background">
      {/* Hero Section */}
      <div className="flex-1 flex-col flex items-center justify-center py-[4px] px-[16px] my-[2px] mx-[10px]">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg">
          <MessageSquare className="h-10 w-10 text-primary-foreground" />
        </div>
        
        <h1 className="mb-3 text-center text-4xl font-bold tracking-tight">
          Delton
        </h1>
        <p className="mb-8 max-w-sm text-center text-lg text-muted-foreground">
          Your intelligent AI assistant for instant, accurate answers
        </p>

        {/* Features */}
        <div className="mb-10 grid w-full max-w-sm gap-4">
          {features.map(({
          icon: Icon,
          title,
          description
        }) => <div key={title} className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>)}
        </div>

        {/* CTA Buttons */}
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Button size="lg" className="h-12 text-base font-semibold" onClick={() => navigate('/auth')}>
            Get Started
          </Button>
          <Button variant="outline" size="lg" className="h-12 text-base" onClick={() => navigate('/auth?mode=login')}>
            I already have an account
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center">
        <p className="text-sm text-muted-foreground">Powered by Delton </p>
      </footer>
    </div>;
}