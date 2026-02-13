import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { VoiceInputButton } from './VoiceInputButton';
import { ImageUploadButton } from './ImageUploadButton';
import { CameraCapture } from './CameraCapture';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageImage } from '@/lib/types';

interface ChatInputProps {
  onSend: (message: string, images?: MessageImage[]) => void;
  disabled?: boolean;
  onMicStateChange?: (isActive: boolean) => void;
}

export function ChatInput({ onSend, disabled, onMicStateChange }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [interimText, setInterimText] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [images, setImages] = useState<MessageImage[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    const loadLanguage = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('user_settings')
        .select('voice_language')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.voice_language) {
        setLanguage(data.voice_language);
      }
    };
    loadLanguage();
  }, [user]);

  const { isListening, isSupported, toggleListening } = useVoiceInput({
    onResult: (transcript) => {
      setMessage((prev) => (prev + ' ' + transcript).trim());
      setInterimText('');
    },
    onInterimResult: (transcript) => {
      setInterimText(transcript);
    },
    language,
  });

  useEffect(() => {
    onMicStateChange?.(isListening);
  }, [isListening, onMicStateChange]);

  const handleSend = () => {
    const trimmed = message.trim();
    if ((!trimmed && images.length === 0) || disabled) return;
    onSend(trimmed || 'What do you see in this image?', images.length > 0 ? images : undefined);
    setMessage('');
    setInterimText('');
    setImages([]);
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
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  };

  const displayText = interimText ? `${message} ${interimText}`.trim() : message;
  const hasContent = message.trim() || images.length > 0;

  return (
    <div className="p-3 sm:p-4">
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {images.map((image, index) => (
            <div
              key={index}
              className="relative w-16 h-16 rounded-xl overflow-hidden border border-border"
            >
              <img
                src={image.url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setImages(images.filter((_, i) => i !== index))}
                className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-background/90 hover:bg-background text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
        <div className="flex items-center gap-1 shrink-0">
          <ImageUploadButton
            images={images}
            onImagesChange={setImages}
            disabled={disabled}
          />
          <CameraCapture
            onCapture={(image) => setImages(prev => [...prev, image])}
            disabled={disabled || images.length >= 4}
          />
          <VoiceInputButton
            isListening={isListening}
            isSupported={isSupported}
            onClick={toggleListening}
            disabled={disabled}
          />
        </div>

        <Textarea
          ref={textareaRef}
          value={displayText}
          onChange={(e) => {
            setMessage(e.target.value);
            setInterimText('');
          }}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={isListening ? "Listening..." : "Message Delton..."}
          className={cn(
            "min-h-[40px] max-h-40 resize-none border-0 bg-transparent p-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60",
            isListening && "text-primary"
          )}
          rows={1}
          disabled={disabled}
        />

        <Button
          size="icon"
          className={cn(
            "h-9 w-9 shrink-0 rounded-xl transition-all",
            hasContent && !disabled
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground"
          )}
          disabled={!hasContent || disabled}
          onClick={handleSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/50 mt-2">
        Delton can make mistakes. Consider checking important information.
      </p>
    </div>
  );
}
