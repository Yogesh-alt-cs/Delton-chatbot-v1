import { useState } from 'react';
import { Copy, ThumbsUp, ThumbsDown, Check, Volume2, VolumeX, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Feedback } from '@/lib/types';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useShareConversation } from '@/hooks/useShareConversation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  const { isSupported: ttsSupported, isSpeaking, speak, stop } = useTextToSpeech();
  const { shareMessage } = useShareConversation();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      stop();
    } else {
      speak(content);
    }
  };

  const handleShare = () => {
    shareMessage(content);
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5 mt-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 sm:opacity-0 max-sm:opacity-70">
        {/* Copy */}
        <Tooltip>
          <TooltipTrigger asChild>
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
          </TooltipTrigger>
          <TooltipContent><p>Copy</p></TooltipContent>
        </Tooltip>

        {/* Text to Speech */}
        {ttsSupported && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7", isSpeaking && "text-primary bg-primary/10")}
                onClick={handleSpeak}
                disabled={disabled}
              >
                {isSpeaking ? (
                  <VolumeX className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>{isSpeaking ? 'Stop' : 'Read aloud'}</p></TooltipContent>
          </Tooltip>
        )}

        {/* Share */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleShare}
              disabled={disabled}
            >
              <Share2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Share</p></TooltipContent>
        </Tooltip>

        {/* Like */}
        <Tooltip>
          <TooltipTrigger asChild>
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
          </TooltipTrigger>
          <TooltipContent><p>Like</p></TooltipContent>
        </Tooltip>

        {/* Dislike */}
        <Tooltip>
          <TooltipTrigger asChild>
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
          </TooltipTrigger>
          <TooltipContent><p>Dislike</p></TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
