import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function AppLayout({ children, showNav = true }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className={showNav ? "flex-1 pb-16" : "flex-1"}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
