import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function AppLayout({ children, showNav = true }: AppLayoutProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background crt-flicker">
      <main className={showNav ? "flex-1 pb-16 lg:pb-0" : "flex-1"}>
        {children}
      </main>
      {showNav && <BottomNav />}
      {/* CRT scanline overlay — terminal vibe */}
      <div className="crt-scanlines" aria-hidden="true" />
    </div>
  );
}
