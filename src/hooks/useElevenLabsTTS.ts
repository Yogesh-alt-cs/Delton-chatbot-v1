import { useState, useCallback, useRef } from 'react';

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

// ElevenLabs voice options
export const ELEVENLABS_VOICES = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Deep, warm male voice' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Natural female voice' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Friendly female voice' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Casual male voice' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Young male voice' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', description: 'Warm female voice' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Clear female voice' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'British male voice' },
];

export function useElevenLabsTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string, voiceId?: string): Promise<boolean> => {
    if (!text.trim()) return false;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          text: text.slice(0, 5000), // Limit text length
          voiceId: voiceId || 'JBFqnCBsd6RMkjVDRZzb', // Default to George
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'TTS request failed');
      }

      const data = await response.json();

      if (!data.audioContent) {
        throw new Error('No audio content received');
      }

      // Create audio from base64
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      
      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      return new Promise((resolve) => {
        audio.onplay = () => {
          setIsSpeaking(true);
          setIsLoading(false);
        };

        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          resolve(true);
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          setIsLoading(false);
          setError('Failed to play audio');
          audioRef.current = null;
          resolve(false);
        };

        audio.play().catch((err) => {
          console.error('Audio play error:', err);
          setIsSpeaking(false);
          setIsLoading(false);
          setError('Failed to play audio');
          resolve(false);
        });
      });
    } catch (err) {
      console.error('TTS error:', err);
      setError(err instanceof Error ? err.message : 'TTS failed');
      setIsLoading(false);
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    isLoading,
    error,
    voices: ELEVENLABS_VOICES,
  };
}
