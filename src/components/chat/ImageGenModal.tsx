import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ImageGenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageGenerated: (url: string, prompt: string) => void;
}

const styles = ['Realistic', 'Artistic', 'Anime', 'Minimal'] as const;
const aspects = [
  { label: 'Square', w: 512, h: 512 },
  { label: 'Landscape', w: 768, h: 512 },
  { label: 'Portrait', w: 512, h: 768 },
] as const;

export function ImageGenModal({ isOpen, onClose, onImageGenerated }: ImageGenModalProps) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<typeof styles[number]>('Realistic');
  const [aspect, setAspect] = useState<typeof aspects[number]>(aspects[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');

    try {
      const fullPrompt = `${prompt}, ${style.toLowerCase()} style`;
      const encoded = encodeURIComponent(fullPrompt);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=${aspect.w}&height=${aspect.h}&nologo=true&seed=${Date.now()}`;
      
      // Pre-load the image to verify it works
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to generate'));
        img.src = url;
      });

      onImageGenerated(url, prompt);
      setPrompt('');
    } catch {
      setError('Image generation failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:w-full"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="glass-panel-strong rounded-t-3xl sm:rounded-3xl p-5 border border-border/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Generate Image
                </h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-accent/50">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <Input
                placeholder="Describe the image you want..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
                className="mb-3 bg-accent border-border/50"
              />

              {/* Style selector */}
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-1.5">Style</p>
                <div className="flex gap-1.5">
                  {styles.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        style === s ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect ratio */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-1.5">Aspect Ratio</p>
                <div className="flex gap-1.5">
                  {aspects.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => setAspect(a)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        aspect.label === a.label ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-destructive mb-2">{error}</p>}

              <Button onClick={handleGenerate} disabled={!prompt.trim() || loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {loading ? 'Generating...' : '✨ Generate'}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
