import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface UseVoiceInputOptions {
  onResult?: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
  continuous?: boolean;
  language?: string;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionError {
  error: string;
  message?: string;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const { onResult, onInterimResult, continuous = false, language = 'en-US' } = options;
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const recognitionRef = useRef<any>(null);
  const accumulatedTranscriptRef = useRef('');
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
    
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setHasPermission(false);
      toast.error('Microphone access denied. Please enable it in your browser settings.');
      return false;
    }
  }, []);

  const stopListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    accumulatedTranscriptRef.current = '';
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }

    // Stop any existing recognition first
    stopListening();
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('Voice recognition started');
      setIsListening(true);
      accumulatedTranscriptRef.current = '';
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript && onInterimResult) {
        onInterimResult(interimTranscript);
      }

      if (finalTranscript) {
        accumulatedTranscriptRef.current += finalTranscript;
        if (onResult) {
          onResult(finalTranscript);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionError) => {
      console.error('Speech recognition error:', event.error);

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setHasPermission(false);
        setIsListening(false);
        toast.error('Microphone access denied.');
      } else if (event.error === 'audio-capture') {
        setIsListening(false);
        toast.error('Microphone is busy. Close other apps using the mic and try again.');
      } else if (event.error === 'network') {
        setIsListening(false);
        toast.error('Network error. Please check your connection.');
      } else if (event.error === 'no-speech') {
        // This is common, don't show error
        console.log('No speech detected, waiting...');
      } else if (event.error !== 'aborted') {
        console.log('Voice error:', event.error);
      }
    };

    recognition.onend = () => {
      console.log('Voice recognition ended');
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      setIsListening(false);
      toast.error('Failed to start voice recognition. Please try again.');
    }
  }, [isSupported, hasPermission, continuous, language, onResult, onInterimResult, requestPermission, stopListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    hasPermission,
    startListening,
    stopListening,
    toggleListening,
    requestPermission,
  };
}
