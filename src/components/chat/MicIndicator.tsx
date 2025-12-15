import { useEffect, useMemo, useState } from 'react';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MicIndicatorProps {
  isActive: boolean;
  className?: string;
}

/**
 * MicIndicator shows mic-active state without opening a separate mic stream.
 * (Some browsers fail SpeechRecognition when another getUserMedia stream is active.)
 */
export function MicIndicator({ isActive, className }: MicIndicatorProps) {
  const barCount = 8;
  const baseLevels = useMemo(() => Array(barCount).fill(0), [barCount]);
  const [levels, setLevels] = useState<number[]>(baseLevels);

  useEffect(() => {
    if (!isActive) {
      setLevels(baseLevels);
      return;
    }

    let raf = 0;
    const startedAt = performance.now();

    const tick = () => {
      const t = (performance.now() - startedAt) / 1000;
      // Animated “meter” that reacts smoothly without capturing the microphone.
      setLevels(
        Array.from({ length: barCount }, (_, i) => {
          const wave = (Math.sin(t * 8 + i * 0.9) + 1) / 2;
          const flutter = (Math.sin(t * 21 + i * 1.7) + 1) / 2;
          const level = 20 + wave * 55 + flutter * 25;
          return Math.max(0, Math.min(100, level));
        })
      );
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isActive, baseLevels, barCount]);

  if (!isActive) return null;

  return (
    <div
      className={cn(
        "fixed top-20 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 px-4 py-2.5 rounded-full",
        "bg-destructive text-destructive-foreground shadow-lg",
        "border border-destructive-foreground/20",
        className
      )}
      aria-live="polite"
      aria-label="Microphone is recording"
    >
      <div className="relative">
        <Mic className="h-4 w-4" aria-hidden="true" />
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive-foreground/70 animate-ping" />
      </div>
      <span className="text-sm font-medium">Recording</span>
      <div className="flex items-end gap-0.5 h-5" aria-hidden="true">
        {levels.map((level, i) => (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full transition-[height] duration-75",
              level > 75 ? "bg-accent" : "bg-destructive-foreground"
            )}
            style={{ height: `${Math.max(4, (level / 100) * 20)}px` }}
          />
        ))}
      </div>
    </div>
  );
}
