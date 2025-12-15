import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MicLevelMeterProps {
  stream: MediaStream | null;
  isActive: boolean;
  className?: string;
}

export function MicLevelMeter({ stream, isActive, className }: MicLevelMeterProps) {
  const [level, setLevel] = useState(0);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !isActive) {
      setLevel(0);
      return;
    }

    const audioContext = new AudioContext();
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    analyzer.smoothingTimeConstant = 0.8;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyzer);

    audioContextRef.current = audioContext;
    analyzerRef.current = analyzer;

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);

    const updateLevel = () => {
      if (!analyzerRef.current) return;
      
      analyzerRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
      const normalizedLevel = Math.min(100, (average / 128) * 100);
      
      setLevel(normalizedLevel);
      animationRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stream, isActive]);

  if (!isActive) return null;

  const bars = 12;
  const activeBarCount = Math.ceil((level / 100) * bars);

  return (
    <div className={cn("flex items-center justify-center gap-0.5 h-8", className)}>
      {Array.from({ length: bars }).map((_, i) => {
        const isActiveBar = i < activeBarCount;
        const barHeight = 4 + (i * 2);
        const color = i < bars * 0.5 ? 'bg-emerald-500' : i < bars * 0.8 ? 'bg-yellow-500' : 'bg-red-500';
        
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-full transition-all duration-75",
              isActiveBar ? color : "bg-muted"
            )}
            style={{
              height: `${barHeight}px`,
              opacity: isActiveBar ? 1 : 0.3,
            }}
          />
        );
      })}
    </div>
  );
}

// Hook to get microphone stream
export function useMicrophoneStream(isActive: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(setStream)
      .catch(console.error);

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive]);

  return stream;
}
