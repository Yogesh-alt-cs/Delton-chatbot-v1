import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { Send, Plus, X, Mic, MicOff, Camera, RotateCcw, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { AttachmentMenu } from './AttachmentMenu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageImage } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Inline Camera Dialog
function CameraDialog({ isOpen, onClose, onCapture }: {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (image: MessageImage) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [loading, setLoading] = useState(false);

  const startCamera = useCallback(async () => {
    setLoading(true);
    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(ms);
      if (videoRef.current) { videoRef.current.srcObject = ms; await videoRef.current.play(); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [facingMode, stream]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stream]);

  useEffect(() => { if (isOpen && !captured) startCamera(); return () => stopCamera(); }, [isOpen, facingMode]);
  useEffect(() => { if (!isOpen) { setCaptured(null); stopCamera(); } }, [isOpen]);

  const take = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    if (facingMode === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0);
    setCaptured(c.toDataURL('image/jpeg', 0.9));
    stopCamera();
  };

  const confirm = () => {
    if (!captured) return;
    onCapture({ url: captured, base64: captured.split(',')[1], mimeType: 'image/jpeg' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-4 pb-2"><DialogTitle>Take a Photo</DialogTitle></DialogHeader>
        <div className="relative aspect-[4/3] bg-muted">
          {loading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
          {captured ? <img src={captured} alt="Captured" className="w-full h-full object-cover" /> : <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <div className="p-4 flex items-center justify-center gap-4">
          {captured ? (
            <>
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => { setCaptured(null); startCamera(); }}><RotateCcw className="h-5 w-5" /></Button>
              <Button size="icon" className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90" onClick={confirm}><Check className="h-6 w-6" /></Button>
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={onClose}><X className="h-5 w-5" /></Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} disabled={loading}><RotateCcw className="h-5 w-5" /></Button>
              <Button size="icon" className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 border-4 border-background shadow-lg" onClick={take} disabled={loading || !stream}><div className="h-12 w-12 rounded-full bg-primary-foreground/20" /></Button>
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={onClose}><X className="h-5 w-5" /></Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
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

  const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages: MessageImage[] = [];
    for (const file of files) {
      if (images.length + newImages.length >= 4) break;
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 10 * 1024 * 1024) continue;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
      });
      newImages.push({ url: URL.createObjectURL(file), base64, mimeType: file.type });
    }
    setImages((prev) => [...prev, ...newImages]);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const displayText = interimText ? `${message} ${interimText}`.trim() : message;
  const hasContent = message.trim() || images.length > 0;

  return (
    <div className="p-3 sm:p-4">
      {/* Image previews */}
      <AnimatePresence>
        {images.length > 0 && (
          <motion.div
            className="flex gap-2 flex-wrap mb-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {images.map((image, index) => (
              <motion.div
                key={index}
                className="relative w-14 h-14 rounded-xl overflow-hidden border border-border/50"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <img
                  src={image.url}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <motion.button
                  onClick={() => setImages(images.filter((_, i) => i !== index))}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-background/90 hover:bg-background text-foreground"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="h-3 w-3" />
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified input bar */}
      <div className="relative flex items-end gap-1.5 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-1.5 shadow-sm focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/15 transition-all">
        {/* Attachment button */}
        <div className="relative shrink-0">
          <motion.button
            type="button"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-xl transition-colors',
              'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              attachmentOpen && 'bg-muted/50 text-foreground'
            )}
            onClick={() => setAttachmentOpen(!attachmentOpen)}
            disabled={disabled}
            whileTap={{ scale: 0.92 }}
            animate={{ rotate: attachmentOpen ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Plus className="h-5 w-5" />
          </motion.button>

          <AttachmentMenu
            isOpen={attachmentOpen}
            onClose={() => setAttachmentOpen(false)}
            onCameraOpen={() => setShowCamera(true)}
            onPhotoSelect={() => photoInputRef.current?.click()}
            onDocumentSelect={() => docInputRef.current?.click()}
            disabled={disabled}
          />
        </div>

        {/* Hidden file inputs */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={handlePhotoFiles}
          className="hidden"
        />
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.txt,.csv,.md,.docx"
          multiple
          onChange={(e) => {
            // Document upload handled by parent
            if (docInputRef.current) docInputRef.current.value = '';
          }}
          className="hidden"
        />

        {/* Text input */}
        <Textarea
          ref={textareaRef}
          value={displayText}
          onChange={(e) => {
            setMessage(e.target.value);
            setInterimText('');
          }}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={isListening ? 'Listening...' : 'Message Delton...'}
          className={cn(
            'min-h-[40px] max-h-40 resize-none border-0 bg-transparent p-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50',
            isListening && 'text-primary'
          )}
          rows={1}
          disabled={disabled}
        />

        {/* Right side: mic + send */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Mic button */}
          {isSupported && (
            <motion.button
              type="button"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-xl transition-all',
                isListening
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              onClick={toggleListening}
              disabled={disabled}
              whileTap={{ scale: 0.92 }}
            >
              <AnimatePresence mode="wait">
                {isListening ? (
                  <motion.div
                    key="mic-off"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <MicOff className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="mic-on"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Mic className="h-4 w-4" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Listening pulse ring */}
              {isListening && (
                <motion.span
                  className="absolute inset-0 rounded-xl border-2 border-primary/40"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </motion.button>
          )}

          {/* Send button */}
          <motion.button
            type="button"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-xl transition-all',
              hasContent && !disabled
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground'
            )}
            disabled={!hasContent || disabled}
            onClick={handleSend}
            whileHover={hasContent && !disabled ? { scale: 1.05 } : {}}
            whileTap={hasContent && !disabled ? { scale: 0.92 } : {}}
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      {/* Listening indicator */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            className="flex items-center justify-center gap-1.5 mt-2"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-primary font-medium">Listening...</span>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-[10px] text-muted-foreground/40 mt-2">
        Delton can make mistakes. Consider checking important information.
      </p>

      {/* Camera Dialog */}
      <CameraDialog
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={(image) => {
          setImages((prev) => [...prev, image]);
          setShowCamera(false);
        }}
      />
    </div>
  );
}
