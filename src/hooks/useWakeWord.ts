import { useState, useEffect, useCallback, useRef } from 'react';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence: number;
      };
      isFinal: boolean;
      length: number;
    };
    length: number;
  };
}

interface SpeechRecognitionError {
  error: string;
  message: string;
}

interface UseWakeWordOptions {
  wakeWord?: string;
  onWakeWordDetected: () => void;
  enabled?: boolean;
}

export function useWakeWord({ 
  wakeWord = 'hey delton', 
  onWakeWordDetected,
  enabled = true 
}: UseWakeWordOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || !enabled) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('Wake word detection started');
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        
        // Check for wake word variations
        if (transcript.includes('hey delton') || 
            transcript.includes('hey dalton') ||
            transcript.includes('hey delta') ||
            transcript.includes('a delton') ||
            transcript.includes('hey dalton') ||
            transcript.includes(wakeWord.toLowerCase())) {
          console.log('Wake word detected!', transcript);
          onWakeWordDetected();
          // Stop listening after wake word is detected
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (e) {
              // Ignore
            }
          }
          return;
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionError) => {
      console.log('Wake word detection error:', event.error);
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        // Restart after error
        restartTimeoutRef.current = setTimeout(() => {
          if (enabled) startListening();
        }, 2000);
      }
    };

    recognition.onend = () => {
      console.log('Wake word detection ended');
      setIsListening(false);
      // Auto-restart if enabled
      if (enabled) {
        restartTimeoutRef.current = setTimeout(() => {
          startListening();
        }, 1000);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.log('Failed to start wake word detection:', e);
    }
  }, [isSupported, enabled, wakeWord, onWakeWordDetected]);

  const stopListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (enabled && isSupported) {
      // Delay start to avoid conflicts
      const timeout = setTimeout(() => {
        startListening();
      }, 1000);
      return () => clearTimeout(timeout);
    } else {
      stopListening();
    }

    return () => {
      stopListening();
    };
  }, [enabled, isSupported]);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}
