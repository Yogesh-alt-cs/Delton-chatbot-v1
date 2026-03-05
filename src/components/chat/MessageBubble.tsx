import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
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
    <div
      className={cn(
        "group flex gap-3 px-4 py-4 transition-colors",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {isAssistant && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full glass-panel mt-0.5">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}

      <div className={cn("flex flex-col gap-1.5 max-w-[80%] sm:max-w-[70%]", isUser ? "items-end" : "items-start")}>
        {images && images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1">
            {images.map((image, index) => (
              <img
                key={index}
                src={image.url}
                alt={`Uploaded ${index + 1}`}
                className="max-w-[200px] max-h-[200px] rounded-2xl object-cover border border-border/30"
              />
            ))}
          </div>
        )}

        <div
          className={cn(
            "rounded-[20px] px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-lg"
              : "glass-panel rounded-bl-lg"
          )}
        >
          <p className="whitespace-pre-wrap break-words">
            {content}
            {isStreaming && (
              <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-current rounded-full" />
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

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary mt-0.5">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
