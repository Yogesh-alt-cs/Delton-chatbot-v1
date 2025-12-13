import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { VoiceInputButton } from './VoiceInputButton';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [interimText, setInterimText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isListening, isSupported, toggleListening } = useVoiceInput({
    onResult: (transcript) => {
      setMessage((prev) => (prev + ' ' + transcript).trim());
      setInterimText('');
    },
    onInterimResult: (transcript) => {
      setInterimText(transcript);
    },
  });

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    
    onSend(trimmed);
    setMessage('');
    setInterimText('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }
  };

  // Display text with interim results
  const displayText = interimText ? `${message} ${interimText}`.trim() : message;

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="flex items-end gap-2">
        <VoiceInputButton
          isListening={isListening}
          isSupported={isSupported}
          onClick={toggleListening}
          disabled={disabled}
        />
        <Textarea
          ref={textareaRef}
          value={displayText}
          onChange={(e) => {
            setMessage(e.target.value);
            setInterimText('');
          }}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={isListening ? "Listening..." : "Type a message..."}
          className={cn(
            "min-h-[44px] max-h-32 resize-none rounded-xl",
            isListening && "border-primary"
          )}
          rows={1}
          disabled={disabled}
        />
        <Button
          size="icon"
          className={cn(
            "h-11 w-11 shrink-0 rounded-xl transition-all",
            (!message.trim() || disabled) && "opacity-50"
          )}
          disabled={!message.trim() || disabled}
          onClick={handleSend}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
