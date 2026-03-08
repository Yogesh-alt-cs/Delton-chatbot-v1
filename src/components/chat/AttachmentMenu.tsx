import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Image, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCameraOpen: () => void;
  onPhotoSelect: () => void;
  onDocumentSelect?: () => void;
  disabled?: boolean;
}

const menuItems = [
  { icon: Camera, label: 'Camera', action: 'camera' as const },
  { icon: Image, label: 'Photos & Files', action: 'photo' as const },
  { icon: FileText, label: 'Upload Document', action: 'document' as const },
];

export function AttachmentMenu({
  isOpen,
  onClose,
  onCameraOpen,
  onPhotoSelect,
  onDocumentSelect,
  disabled,
}: AttachmentMenuProps) {
  const handleAction = (action: string) => {
    switch (action) {
      case 'camera': onCameraOpen(); break;
      case 'photo': onPhotoSelect(); break;
      case 'document': onDocumentSelect?.(); break;
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className={cn(
              'absolute bottom-full left-0 mb-2 z-50',
              'glass-panel-strong rounded-2xl p-1.5 min-w-[200px]',
            )}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {menuItems.map((item, index) => (
              <motion.button
                key={item.action}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5',
                  'text-sm text-foreground/80 hover:text-foreground',
                  'hover:bg-accent/50 transition-colors',
                  disabled && 'opacity-50 pointer-events-none'
                )}
                onClick={() => handleAction(item.action)}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </motion.button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
