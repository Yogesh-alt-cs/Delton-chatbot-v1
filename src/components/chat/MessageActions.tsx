import { useState } from 'react';
import { Copy, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Feedback } from '@/lib/types';

interface MessageActionsProps {
  messageId: string;
  content: string;
  feedback?: Feedback;
  onFeedback: (messageId: string, type: 'like' | 'dislike') => void;
  disabled?: boolean;
}

export function MessageActions({ 
  messageId, 
  content, 
  feedback,
  onFeedback,
  disabled 
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleCopy}
        disabled={disabled}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-accent" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7",
          feedback?.type === 'like' && "text-accent bg-accent/10"
        )}
        onClick={() => onFeedback(messageId, 'like')}
        disabled={disabled}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7",
          feedback?.type === 'dislike' && "text-destructive bg-destructive/10"
        )}
        onClick={() => onFeedback(messageId, 'dislike')}
        disabled={disabled}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
