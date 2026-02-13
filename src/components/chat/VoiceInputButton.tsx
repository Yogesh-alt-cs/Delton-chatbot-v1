import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VoiceInputButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function VoiceInputButton({
  isListening,
  isSupported,
  onClick,
  disabled,
}: VoiceInputButtonProps) {
  if (!isSupported) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "h-9 w-9 shrink-0 rounded-xl transition-all",
              isListening && "text-destructive bg-destructive/10 animate-pulse"
            )}
            onClick={onClick}
            disabled={disabled}
          >
            {isListening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isListening ? 'Stop listening' : 'Voice input'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
