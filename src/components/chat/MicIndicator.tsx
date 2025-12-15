import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MicIndicatorProps {
  isActive: boolean;
  className?: string;
}

export function MicIndicator({ isActive, className }: MicIndicatorProps) {
  if (!isActive) return null;

  return (
    <div
      className={cn(
        "fixed top-20 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-2 px-4 py-2 rounded-full",
        "bg-destructive text-destructive-foreground shadow-lg",
        "animate-pulse",
        className
      )}
    >
      <Mic className="h-4 w-4" />
      <span className="text-sm font-medium">Recording...</span>
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1 bg-destructive-foreground rounded-full animate-wave"
            style={{
              height: '12px',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
