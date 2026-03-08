import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { Send, Plus, X, Mic, MicOff, RotateCcw, Check, Loader2, FileText } from 'lucide-react';
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

// --- Document text extraction utilities ---

async function extractTextFromTxtOrCsv(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  // Use the bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    pages.push(textContent.items.map((item: any) => item.str).join(' '));
  }
  return pages.join('\n\n');
}

async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export interface DocumentAttachment {
  name: string;
  content: string;
}

// --- Camera Dialog ---

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
      <DialogContent className="sm:max-w-md p-0 overflow-hidden glass-panel-strong rounded-3xl border-border/30">
        <DialogHeader className="p-4 pb-2"><DialogTitle>Take a Photo</DialogTitle></DialogHeader>
        <div className="relative aspect-[4/3] bg-muted rounded-xl overflow-hidden mx-4">
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

// --- Main ChatInput ---

interface ChatInputProps {
  onSend: (message: string, images?: MessageImage[], document?: DocumentAttachment) => void;
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
  const [isFocused, setIsFocused] = useState(false);
  const [sendAnimating, setSendAnimating] = useState(false);
  const [document, setDocument] = useState<DocumentAttachment | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    const loadLanguage = async () => {
      if (!user) return;
      const { data } = await supabase.from('user_settings').select('voice_language').eq('user_id', user.id).maybeSingle();
      if (data?.voice_language) setLanguage(data.voice_language);
    };
    loadLanguage();
  }, [user]);

  const { isListening, isSupported, toggleListening } = useVoiceInput({
    onResult: (transcript) => {
      setMessage((prev) => (prev + ' ' + transcript).trim());
      setInterimText('');
    },
    onInterimResult: (transcript) => setInterimText(transcript),
    language,
  });

  useEffect(() => { onMicStateChange?.(isListening); }, [isListening, onMicStateChange]);

  const handleSend = () => {
    const trimmed = message.trim();
    if ((!trimmed && images.length === 0 && !document) || disabled) return;

    setSendAnimating(true);
    setTimeout(() => setSendAnimating(false), 400);

    onSend(
      trimmed || (document ? `Analyze this document` : 'What do you see in this image?'),
      images.length > 0 ? images : undefined,
      document || undefined,
    );
    setMessage('');
    setInterimText('');
    setImages([]);
    setDocument(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
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

  const handleDocumentFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB limit

    setDocLoading(true);
    try {
      let text = '';
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'txt' || ext === 'csv') {
        text = await extractTextFromTxtOrCsv(file);
      } else if (ext === 'pdf') {
        text = await extractTextFromPdf(file);
      } else if (ext === 'docx') {
        text = await extractTextFromDocx(file);
      }

      // Truncate to ~30k chars to stay within context limits
      if (text.length > 30000) text = text.slice(0, 30000) + '\n\n[Document truncated...]';

      setDocument({ name: file.name, content: text });
    } catch (err) {
      console.error('Document extraction error:', err);
    } finally {
      setDocLoading(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const displayText = interimText ? `${message} ${interimText}`.trim() : message;
  const hasContent = message.trim() || images.length > 0 || !!document;

  return (
    <div>
      {/* Document chip */}
      <AnimatePresence>
        {(document || docLoading) && (
          <motion.div
            className="flex items-center gap-2 mb-2 px-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center gap-2 rounded-xl glass-panel px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              {docLoading ? (
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing...
                </span>
              ) : (
                <>
                  <span className="truncate max-w-[200px]">{document?.name}</span>
                  <button
                    onClick={() => setDocument(null)}
                    className="ml-1 p-0.5 rounded-full hover:bg-accent/50 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image previews */}
      <AnimatePresence>
        {images.length > 0 && (
          <motion.div className="flex gap-2 flex-wrap mb-3 px-2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {images.map((image, index) => (
              <motion.div key={index} className="relative w-14 h-14 rounded-2xl overflow-hidden glass-panel" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ delay: index * 0.05 }}>
                <img src={image.url} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                <motion.button onClick={() => setImages(images.filter((_, i) => i !== index))} className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-background/90 hover:bg-background text-foreground" whileTap={{ scale: 0.9 }}>
                  <X className="h-3 w-3" />
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Bar */}
      <motion.div
        className={cn(
          "relative flex items-end gap-1.5 rounded-[28px] p-1.5 transition-all duration-300",
          "glass-panel-strong",
          isFocused && "glass-glow"
        )}
        layout
      >
        {/* Attachment button */}
        <div className="relative shrink-0">
          <motion.button
            type="button"
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-full transition-colors',
              'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              attachmentOpen && 'bg-accent/50 text-foreground'
            )}
            onClick={() => setAttachmentOpen(!attachmentOpen)}
            disabled={disabled}
            whileTap={{ scale: 0.9 }}
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

        <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={handlePhotoFiles} className="hidden" />
        <input ref={docInputRef} type="file" accept=".pdf,.docx,.txt,.csv" onChange={handleDocumentFile} className="hidden" />

        {/* Text input */}
        <Textarea
          ref={textareaRef}
          value={displayText}
          onChange={(e) => { setMessage(e.target.value); setInterimText(''); }}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isListening ? 'Listening...' : 'Message Delton...'}
          className={cn(
            'min-h-[40px] max-h-40 resize-none border-0 bg-transparent p-2 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40',
            isListening && 'text-primary'
          )}
          rows={1}
          disabled={disabled}
        />

        {/* Right side: mic + send */}
        <div className="flex items-center gap-1 shrink-0">
          {isSupported && (
            <motion.button
              type="button"
              className={cn(
                'relative flex items-center justify-center h-10 w-10 rounded-full transition-all',
                isListening ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
              onClick={toggleListening}
              disabled={disabled}
              whileTap={{ scale: 0.9 }}
            >
              <AnimatePresence mode="wait">
                {isListening ? (
                  <motion.div key="off" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><MicOff className="h-4 w-4" /></motion.div>
                ) : (
                  <motion.div key="on" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Mic className="h-4 w-4" /></motion.div>
                )}
              </AnimatePresence>
              {isListening && (
                <motion.span className="absolute inset-0 rounded-full border-2 border-primary/40" animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 1.5, repeat: Infinity }} />
              )}
            </motion.button>
          )}

          <motion.button
            type="button"
            className={cn(
              'relative flex items-center justify-center h-10 w-10 rounded-full transition-all overflow-hidden',
              hasContent && !disabled
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-accent/50 text-muted-foreground'
            )}
            disabled={!hasContent || disabled}
            onClick={handleSend}
            whileHover={hasContent && !disabled ? { scale: 1.08 } : {}}
            whileTap={hasContent && !disabled ? { scale: 0.85 } : {}}
            animate={sendAnimating ? { rotate: [0, 15, -5, 0], scale: [1, 1.2, 0.95, 1] } : {}}
            transition={sendAnimating ? { duration: 0.4, ease: 'easeOut' } : {}}
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.div>

      {/* Listening indicator */}
      <AnimatePresence>
        {isListening && (
          <motion.div className="flex items-center justify-center gap-1.5 mt-2" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-primary font-medium">Listening...</span>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-[10px] text-muted-foreground/30 mt-2">
        Delton can make mistakes. Consider checking important information.
      </p>

      <CameraDialog
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={(image) => { setImages((prev) => [...prev, image]); setShowCamera(false); }}
      />
    </div>
  );
}
