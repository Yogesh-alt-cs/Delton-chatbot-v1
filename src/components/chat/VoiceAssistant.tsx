import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, VolumeX, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface VoiceAssistantProps {
  onTranscript: (text: string) => void;
  onAssistantResponse?: (text: string) => void;
  isProcessing?: boolean;
}

export function VoiceAssistant({ onTranscript, onAssistantResponse, isProcessing }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionClass && 'speechSynthesis' in window);
  }, []);

  const startListening = useCallback(async () => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognitionClass) {
      toast({
        title: 'Not Supported',
        description: 'Voice recognition is not supported in this browser.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const recognition: ISpeechRecognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const results = Array.from({ length: event.results.length }, (_, i) => event.results[i]);
        const transcript = results
          .map(result => result[0].transcript)
          .join('');
        
        const isFinal = results.some(result => result.isFinal);
        
        if (isFinal) {
          onTranscript(transcript);
          recognition.stop();
          setIsListening(false);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error !== 'aborted') {
          toast({
            title: 'Voice Error',
            description: 'Failed to recognize speech. Please try again.',
            variant: 'destructive',
          });
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (error) {
      console.error('Microphone access error:', error);
      toast({
        title: 'Microphone Access Required',
        description: 'Please allow microphone access to use voice features.',
        variant: 'destructive',
      });
    }
  }, [onTranscript, toast]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const stopSpeaking = useCallback(() => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    if (onAssistantResponse) {
      // This would be called when AI responds
    }
  }, [onAssistantResponse]);

  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isListening ? 'destructive' : 'outline'}
        size="icon"
        onClick={isListening ? stopListening : startListening}
        disabled={isProcessing}
        className={cn(
          'transition-all duration-200',
          isListening && 'animate-pulse'
        )}
        title={isListening ? 'Stop listening' : 'Start voice input'}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isListening ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {isSpeaking && (
        <Button
          variant="outline"
          size="icon"
          onClick={stopSpeaking}
          title="Stop speaking"
        >
          <VolumeX className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}