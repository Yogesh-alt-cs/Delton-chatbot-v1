import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

const features = [
  { code: '01', title: 'EXECUTE', description: 'Analyze complex datasets' },
  { code: '02', title: 'CREATE',  description: 'Generate conceptual drafts' },
  { code: '03', title: 'DEBUG',   description: 'Resolve logical conflicts' },
];

export default function Welcome() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate('/chat', { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top status bar */}
      <header className="brutal-border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-foreground animate-pulse" />
          <span className="font-display text-xl leading-none">DELTON</span>
        </div>
        <div className="font-mono text-[10px] tracking-widest text-muted-foreground hidden sm:block">
          STATUS:ONLINE // LATENCY:12ms
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <div className="font-mono text-[11px] tracking-widest text-muted-foreground mb-4 animate-reveal">
            // SYSTEM_BOOT_SEQUENCE_COMPLETE
          </div>
          <h1 className="font-display text-6xl sm:text-7xl leading-[0.9] mb-6 animate-reveal delay-1">
            INTELLIGENCE.<br/>
            <span className="text-muted-foreground">ON_DEMAND.</span>
          </h1>
          <p className="font-mono text-sm tracking-wide text-muted-foreground mb-10 max-w-md animate-reveal delay-2 uppercase">
            CORE_AI INITIALIZED. STANDBY FOR INPUT. ANALYSIS, WRITING, AND SYNTHESIS PROTOCOL ACTIVE.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 brutal-border mb-10 animate-reveal delay-2">
            {features.map(({ code, title, description }, i) => (
              <div
                key={title}
                className={`p-5 ${i > 0 ? 'brutal-border-l-0 sm:brutal-border-l border-t sm:border-t-0 border-foreground' : ''}`}
                style={i > 0 ? { borderLeft: 'none' } : {}}
              >
                <div className="font-mono text-[10px] tracking-widest text-muted-foreground mb-2">
                  {code} //
                </div>
                <div className="font-display text-2xl mb-1">{title}</div>
                <div className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                  {description}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 animate-reveal delay-3">
            <button
              className="btn-brutal flex-1 text-sm"
              onClick={() => navigate('/auth')}
            >
              INITIATE_SESSION →
            </button>
            <button
              className="flex-1 px-6 py-3 brutal-border bg-background text-foreground font-mono text-xs tracking-widest uppercase hover:bg-foreground hover:text-background transition-colors"
              onClick={() => navigate('/auth?mode=login')}
            >
              EXISTING_USER
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="brutal-border-t px-4 py-3 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
          VER:2.0.0_STABLE
        </span>
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
          SYSTEM_DELTON
        </span>
      </footer>
    </div>
  );
}
