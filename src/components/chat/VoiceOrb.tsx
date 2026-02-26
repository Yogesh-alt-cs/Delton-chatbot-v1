import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface VoiceOrbProps {
  isListening: boolean;
  isSpeaking?: boolean;
  isProcessing?: boolean;
  size?: number;
  className?: string;
}

export function VoiceOrb({
  isListening,
  isSpeaking = false,
  isProcessing = false,
  size = 160,
  className,
}: VoiceOrbProps) {
  const barCount = 24;
  const [levels, setLevels] = useState<number[]>(() => Array(barCount).fill(0.3));
  const rafRef = useRef<number>(0);
  const startRef = useRef(performance.now());

  // Animated waveform bars driven by sin waves (no mic stream needed)
  useEffect(() => {
    if (!isListening && !isSpeaking) {
      setLevels(Array(barCount).fill(0.3));
      return;
    }

    startRef.current = performance.now();

    const tick = () => {
      const t = (performance.now() - startRef.current) / 1000;
      const speed = isSpeaking ? 6 : 10;
      const intensity = isSpeaking ? 0.5 : 0.8;

      setLevels(
        Array.from({ length: barCount }, (_, i) => {
          const angle = (i / barCount) * Math.PI * 2;
          const wave1 = Math.sin(t * speed + angle * 3) * 0.5 + 0.5;
          const wave2 = Math.sin(t * (speed * 1.7) + angle * 5) * 0.3 + 0.5;
          const wave3 = Math.sin(t * (speed * 0.5) + angle) * 0.2 + 0.5;
          const combined = (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2) * intensity;
          return 0.15 + combined * 0.85;
        })
      );
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isListening, isSpeaking, barCount]);

  const isActive = isListening || isSpeaking || isProcessing;

  return (
    <motion.div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Outer glow rings */}
      <AnimatePresence>
        {isActive && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)`,
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.4, 0.1, 0.4],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute inset-4 rounded-full"
              style={{
                background: `radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, transparent 70%)`,
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.5, 0.2, 0.5],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Main orb circle */}
      <motion.div
        className={cn(
          'absolute rounded-full border transition-colors duration-500',
          isListening && 'border-primary/40 voice-orb-glow-active',
          isSpeaking && 'border-primary/30 voice-orb-glow',
          isProcessing && 'border-muted/40',
          !isActive && 'border-border/50'
        )}
        style={{
          width: size * 0.7,
          height: size * 0.7,
          background: isActive
            ? `radial-gradient(circle at 40% 40%, hsl(var(--primary) / 0.15), hsl(var(--card) / 0.9))`
            : `hsl(var(--card) / 0.6)`,
        }}
        animate={
          !isActive
            ? { scale: [1, 1.03, 1] }
            : isProcessing
            ? { rotate: 360 }
            : {}
        }
        transition={
          !isActive
            ? { duration: 3, repeat: Infinity, ease: 'easeInOut' }
            : isProcessing
            ? { duration: 2, repeat: Infinity, ease: 'linear' }
            : {}
        }
      />

      {/* Waveform bars arranged in a circle */}
      <div
        className="absolute"
        style={{ width: size * 0.55, height: size * 0.55 }}
      >
        {levels.map((level, i) => {
          const angle = (i / barCount) * 360;
          const barHeight = 4 + level * 20;
          const radius = (size * 0.55) / 2 - 2;

          return (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 2.5,
                height: barHeight,
                left: '50%',
                top: '50%',
                transformOrigin: 'center center',
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px)`,
                background: isListening
                  ? `hsl(var(--primary))`
                  : isSpeaking
                  ? `hsl(var(--primary) / 0.7)`
                  : `hsl(var(--muted-foreground) / 0.3)`,
                opacity: isActive ? 0.6 + level * 0.4 : 0.2,
              }}
              transition={{ duration: 0.08 }}
            />
          );
        })}
      </div>

      {/* Center processing spinner */}
      {isProcessing && (
        <motion.div
          className="absolute w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}
