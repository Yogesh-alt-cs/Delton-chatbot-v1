import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { MessageActions } from './MessageActions';
import { Feedback, MessageImage } from '@/lib/types';

interface MessageBubbleProps {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: MessageImage[];
  isStreaming?: boolean;
  feedback?: Feedback;
  onFeedback?: (messageId: string, type: 'like' | 'dislike') => void;
  showActions?: boolean;
}

export function MessageBubble({
  id,
  role,
  content,
  images,
  isStreaming,
  feedback,
  onFeedback,
  showActions = true
}: MessageBubbleProps) {
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';

  return (
    <motion.div
      className="group flex gap-0 px-4 py-3 brutal-border-b"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Author label column */}
      <div className="w-20 shrink-0 pt-1">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
          {isUser ? 'USER >' : 'DELTON >'}
        </span>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        {images && images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((image, index) => (
              <img
                key={index}
                src={image.url}
                alt={`Uploaded ${index + 1}`}
                className="max-w-[220px] max-h-[220px] object-cover brutal-border"
              />
            ))}
          </div>
        )}

        <div
          className={cn(
            "px-3 py-2 text-sm leading-relaxed font-sans",
            isUser
              ? "bg-foreground text-background"
              : "bg-background text-foreground brutal-border"
          )}
        >
          <p className="whitespace-pre-wrap break-words">
            {content}
            {isStreaming && (
              <span className="ml-1 inline-block h-4 w-2 bg-current animate-pulse align-middle" />
            )}
          </p>
        </div>

        {isAssistant && showActions && !isStreaming && content && onFeedback && (
          <MessageActions
            messageId={id}
            content={content}
            feedback={feedback}
            onFeedback={onFeedback}
          />
        )}
      </div>
    </motion.div>
  );
}
