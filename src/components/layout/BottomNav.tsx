import { MessageSquare, Clock, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/chat', icon: MessageSquare, label: 'CHAT' },
  { path: '/history', icon: Clock, label: 'HIST' },
  { path: '/settings', icon: Settings, label: 'CFG' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background brutal-border-t safe-bottom lg:hidden">
      <div className="flex h-16 items-stretch">
        {navItems.map(({ path, icon: Icon, label }, idx) => {
          const isActive = location.pathname.startsWith(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 min-h-[48px] touch-manipulation transition-colors font-mono text-[10px] tracking-wider",
                idx > 0 && "brutal-border-l",
                isActive
                  ? "bg-foreground text-background"
                  : "bg-background text-foreground hover:bg-foreground hover:text-background"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span className="font-bold">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
