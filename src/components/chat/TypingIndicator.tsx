import { motion } from 'framer-motion';

export function TypingIndicator() {
  return (
    <motion.div
      className="flex gap-0 px-4 py-3 brutal-border-b"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="w-20 shrink-0 pt-1">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
          DELTON &gt;
        </span>
      </div>
      <div className="flex-1 flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-2 brutal-border">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 bg-foreground"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          PROCESSING...
        </span>
      </div>
    </motion.div>
  );
}
