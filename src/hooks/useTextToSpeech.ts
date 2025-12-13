import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseTextToSpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}) {
  const { rate = 1, pitch = 1, volume = 1 } = options;
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [savedVoiceName, setSavedVoiceName] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { user } = useAuth();

  // Load saved voice preference
  useEffect(() => {
    const loadSavedVoice = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('user_settings')
        .select('tts_voice_name')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data?.tts_voice_name && data.tts_voice_name !== 'default') {
        setSavedVoiceName(data.tts_voice_name);
      }
    };
    
    loadSavedVoice();
  }, [user]);

  useEffect(() => {
    const supported = 'speechSynthesis' in window;
    setIsSupported(supported);

    if (supported) {
      const loadVoices = () => {
        const availableVoices = speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        // If we have a saved voice preference, use it
        if (savedVoiceName) {
          const savedVoice = availableVoices.find(v => v.name === savedVoiceName);
          if (savedVoice) {
            setSelectedVoice(savedVoice);
            return;
          }
        }
        
        // Select a good default voice (prefer English voices)
        const englishVoice = availableVoices.find(
          (v) => v.lang.startsWith('en') && v.name.includes('Google')
        ) || availableVoices.find(
          (v) => v.lang.startsWith('en')
        ) || availableVoices[0];
        
        if (englishVoice && !selectedVoice) {
          setSelectedVoice(englishVoice);
        }
      };

      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;

      return () => {
        speechSynthesis.onvoiceschanged = null;
      };
    }
  }, [savedVoiceName, selectedVoice]);

  const speak = useCallback((text: string) => {
    if (!isSupported || !text.trim()) return;

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [isSupported, rate, pitch, volume, selectedVoice]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported || !isSpeaking) return;
    speechSynthesis.pause();
    setIsPaused(true);
  }, [isSupported, isSpeaking]);

  const resume = useCallback(() => {
    if (!isSupported || !isPaused) return;
    speechSynthesis.resume();
    setIsPaused(false);
  }, [isSupported, isPaused]);

  const toggle = useCallback(() => {
    if (isPaused) {
      resume();
    } else if (isSpeaking) {
      pause();
    }
  }, [isPaused, isSpeaking, pause, resume]);

  const setVoiceByName = useCallback((voiceName: string) => {
    const voice = voices.find(v => v.name === voiceName);
    if (voice) {
      setSelectedVoice(voice);
    }
  }, [voices]);

  return {
    isSupported,
    isSpeaking,
    isPaused,
    voices,
    selectedVoice,
    setSelectedVoice,
    setVoiceByName,
    speak,
    stop,
    pause,
    resume,
    toggle,
  };
}
