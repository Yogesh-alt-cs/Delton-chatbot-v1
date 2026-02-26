import { useEffect, useMemo, useState } from 'react';
import { Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MicIndicatorProps {
  isActive: boolean;
  className?: string;
}

export function MicIndicator({ isActive, className }: MicIndicatorProps) {
  const barCount = 5;
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
      setLevels(
        Array.from({ length: barCount }, (_, i) => {
          const wave = (Math.sin(t * 8 + i * 0.9) + 1) / 2;
          const flutter = (Math.sin(t * 21 + i * 1.7) + 1) / 2;
          return Math.max(0, Math.min(100, 20 + wave * 55 + flutter * 25));
        })
      );
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isActive, baseLevels, barCount]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className={cn(
            'fixed top-20 left-1/2 -translate-x-1/2 z-50',
            'flex items-center gap-3 px-4 py-2.5 rounded-full',
            'glass-panel shadow-lg',
            className
          )}
          initial={{ opacity: 0, y: -10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.9 }}
          aria-live="polite"
          aria-label="Microphone is recording"
        >
          <div className="relative">
            <Mic className="h-4 w-4 text-primary" aria-hidden="true" />
            <motion.span
              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          </div>
          <span className="text-sm font-medium text-foreground">Recording</span>
          <div className="flex items-end gap-0.5 h-5" aria-hidden="true">
            {levels.map((level, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-primary transition-[height] duration-75"
                style={{ height: `${Math.max(4, (level / 100) * 20)}px` }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
