import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';

export function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <motion.div
        className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <MessageSquare className="h-10 w-10 text-primary-foreground" />
      </motion.div>
      <motion.p
        className="mt-4 text-lg font-semibold text-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Delton AI
      </motion.p>
    </motion.div>
  );
}
