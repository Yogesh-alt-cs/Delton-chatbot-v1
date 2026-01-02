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
        "group flex gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary" : "bg-accent"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-accent-foreground" />
        )}
      </div>

      {/* Message Container */}
      <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        {/* Images */}
        {images && images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((image, index) => (
              <img
                key={index}
                src={image.url}
                alt={`Uploaded ${index + 1}`}
                className="max-w-[200px] max-h-[200px] rounded-lg object-cover border border-border"
              />
            ))}
          </div>
        )}
        
        {/* Bubble */}
        <div
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-2.5",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md"
          )}
        >
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {content}
            {isStreaming && (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current" />
            )}
          </p>
        </div>

        {/* Actions (only for assistant messages) */}
        {isAssistant && showActions && !isStreaming && content && onFeedback && (
          <MessageActions
            messageId={id}
            content={content}
            feedback={feedback}
            onFeedback={onFeedback}
          />
        )}
      </div>
    </div>
  );
}
