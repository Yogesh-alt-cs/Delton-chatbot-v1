import { Bot } from 'lucide-react';
import { motion } from 'framer-motion';

export function TypingIndicator() {
  return (
    <motion.div
      className="flex gap-3 px-4 py-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Avatar with pulsing glow ring */}
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/20"
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full glass-panel">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      </div>

      {/* Thinking content */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md glass-panel px-4 py-3">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-primary/60"
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground italic pl-1">
          Delton is thinking...
        </span>
      </div>
    </motion.div>
  );
}
