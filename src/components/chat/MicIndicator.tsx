import { useState, useEffect } from 'react';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MicIndicatorProps {
  isActive: boolean;
  className?: string;
}

export function MicIndicator({ isActive, className }: MicIndicatorProps) {
  const [levels, setLevels] = useState<number[]>(Array(8).fill(0));
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!isActive) {
      setLevels(Array(8).fill(0));
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      return;
    }

    let animationId: number;
    let audioContext: AudioContext;
    let analyzer: AnalyserNode;

    const setup = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(mediaStream);
        
        audioContext = new AudioContext();
        analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 64;
        analyzer.smoothingTimeConstant = 0.5;
        
        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(analyzer);
        
        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        
        const updateLevels = () => {
          analyzer.getByteFrequencyData(dataArray);
          
          // Sample 8 bars from the frequency data
          const newLevels = Array.from({ length: 8 }, (_, i) => {
            const index = Math.floor((i / 8) * dataArray.length);
            return Math.min(100, (dataArray[index] / 255) * 100);
          });
          
          setLevels(newLevels);
          animationId = requestAnimationFrame(updateLevels);
        };
        
        updateLevels();
      } catch (error) {
        console.error('Failed to access microphone for level meter:', error);
      }
    };

    setup();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (audioContext) audioContext.close();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div
      className={cn(
        "fixed top-20 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 px-4 py-2.5 rounded-full",
        "bg-gradient-to-r from-destructive to-destructive/90 text-destructive-foreground shadow-lg",
        "border border-destructive-foreground/20",
        className
      )}
    >
      <div className="relative">
        <Mic className="h-4 w-4" />
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-300 rounded-full animate-ping" />
      </div>
      <span className="text-sm font-medium">Recording</span>
      <div className="flex items-end gap-0.5 h-5">
        {levels.map((level, i) => (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full transition-all duration-75",
              level > 70 ? "bg-yellow-300" : "bg-destructive-foreground"
            )}
            style={{
              height: `${Math.max(4, (level / 100) * 20)}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
