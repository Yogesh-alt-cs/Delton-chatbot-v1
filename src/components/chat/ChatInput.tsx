import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send } from 'lucide-react';
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

  // Load user's preferred language
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

  // Notify parent of mic state changes
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
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {images.map((image, index) => (
            <div 
              key={index} 
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-border"
            >
              <img 
                src={image.url} 
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setImages(images.filter((_, i) => i !== index))}
                className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-background/80 hover:bg-background text-foreground"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex items-end gap-2">
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
        <Textarea
          ref={textareaRef}
          value={displayText}
          onChange={(e) => {
            setMessage(e.target.value);
            setInterimText('');
          }}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={isListening ? "Listening..." : images.length > 0 ? "Ask about the image..." : "Type a message..."}
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
            ((!message.trim() && images.length === 0) || disabled) && "opacity-50"
          )}
          disabled={(!message.trim() && images.length === 0) || disabled}
          onClick={handleSend}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
