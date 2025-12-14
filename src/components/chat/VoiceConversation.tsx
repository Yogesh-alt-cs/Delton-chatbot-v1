import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, VolumeX, Loader2, Phone, PhoneOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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
  abort(): void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface VoiceConversationProps {
  onMessage?: (role: 'user' | 'assistant', content: string) => void;
  onSaveMessage?: (role: 'user' | 'assistant', content: string) => void;
  conversationId?: string;
  personalization?: { name: string | null; style: string; language?: string };
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export function VoiceConversation({ 
  onMessage, 
  onSaveMessage,
  conversationId,
  personalization = { name: null, style: 'balanced', language: 'en-US' }
}: VoiceConversationProps) {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionClass && 'speechSynthesis' in window);
  }, []);

  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }
      
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      // Try to get a good voice
      const voices = speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) 
        || voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };
      
      speechSynthesis.speak(utterance);
    });
  }, []);

  const sendToAI = useCallback(async (userMessage: string) => {
    setIsProcessing(true);
    
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    onMessage?.('user', userMessage);
    onSaveMessage?.('user', userMessage);
    
    try {
      const chatMessages = [
        ...(personalization.name ? [{ role: 'system' as const, content: `USER_NAME:${personalization.name}` }] : []),
        { role: 'system' as const, content: `USER_STYLE:${personalization.style}` },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: chatMessages,
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error('AI request failed');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (assistantContent) {
        setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
        onMessage?.('assistant', assistantContent);
        onSaveMessage?.('assistant', assistantContent);
        
        // Speak the response
        await speakText(assistantContent);
      }
    } catch (error) {
      console.error('AI error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get AI response',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [messages, conversationId, personalization, onMessage, onSaveMessage, speakText, toast]);

  const startListening = useCallback(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognitionClass) {
      console.error('Speech recognition not supported');
      return;
    }
    
    if (isSpeaking || isProcessing) {
      console.log('Cannot start listening: speaking or processing');
      return;
    }

    // Stop any existing recognition first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }

    const recognition: ISpeechRecognition = new SpeechRecognitionClass();
    recognition.continuous = false; // Changed to false for better reliability
    recognition.interimResults = true;
    recognition.lang = personalization.language || 'en-US';

    let finalTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      
      // Show interim results
      if (interimTranscript) {
        setTranscript(interimTranscript);
      }
      
      // Process final result
      if (finalTranscript.trim()) {
        console.log('Final transcript:', finalTranscript.trim());
        setTranscript('');
        const messageToSend = finalTranscript.trim();
        finalTranscript = ''; // Reset for next recognition
        sendToAI(messageToSend);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      // Handle specific errors
      if (event.error === 'no-speech') {
        // No speech detected, restart listening
        console.log('No speech detected, restarting...');
        if (shouldRestartRef.current && !isProcessing && !isSpeaking) {
          setTimeout(() => {
            if (shouldRestartRef.current) {
              startListening();
            }
          }, 300);
        }
      } else if (event.error === 'aborted') {
        // Recognition was aborted, this is expected during mode switches
        console.log('Recognition aborted');
      } else if (event.error === 'network') {
        toast({
          title: 'Network Error',
          description: 'Please check your internet connection.',
          variant: 'destructive',
        });
      } else if (event.error === 'not-allowed') {
        toast({
          title: 'Microphone Blocked',
          description: 'Please allow microphone access in your browser.',
          variant: 'destructive',
        });
        shouldRestartRef.current = false;
        setIsActive(false);
      }
    };

    recognition.onend = () => {
      console.log('Recognition ended, isActive:', shouldRestartRef.current);
      setIsListening(false);
      
      // Auto-restart if still active and not processing/speaking
      if (shouldRestartRef.current && !isProcessing && !isSpeaking) {
        setTimeout(() => {
          if (shouldRestartRef.current && !isProcessing && !isSpeaking) {
            console.log('Auto-restarting listening...');
            startListening();
          }
        }, 300);
      }
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
      console.log('Recognition started successfully');
      setIsListening(true);
    } catch (error) {
      console.error('Failed to start recognition:', error);
      setIsListening(false);
      
      // Retry after a short delay
      if (shouldRestartRef.current) {
        setTimeout(() => {
          if (shouldRestartRef.current) {
            startListening();
          }
        }, 500);
      }
    }
  }, [isSpeaking, isProcessing, sendToAI, toast]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setTranscript('');
  }, []);

  const startConversation = useCallback(async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Release the stream
      
      setIsActive(true);
      shouldRestartRef.current = true;
      
      // Welcome message first, then start listening
      await speakText("Hi! I'm Delton, your AI assistant. How can I help you today?");
      
      // Start listening after welcome message
      startListening();
    } catch (error) {
      console.error('Microphone access error:', error);
      toast({
        title: 'Microphone Required',
        description: 'Please allow microphone access for voice conversation.',
        variant: 'destructive',
      });
    }
  }, [startListening, speakText, toast]);

  const endConversation = useCallback(() => {
    shouldRestartRef.current = false;
    stopListening();
    speechSynthesis.cancel();
    setIsActive(false);
    setIsSpeaking(false);
    setMessages([]);
    setTranscript('');
  }, [stopListening]);

  // Note: Auto-restart is now handled in recognition.onend callback

  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {isActive ? (
        <>
          {/* Status indicator */}
          <div className="flex items-center gap-2 text-sm">
            {isProcessing ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </span>
            ) : isSpeaking ? (
              <span className="flex items-center gap-2 text-primary">
                <Volume2 className="h-4 w-4 animate-pulse" />
                Delton is speaking...
              </span>
            ) : isListening ? (
              <span className="flex items-center gap-2 text-emerald-500">
                <Mic className="h-4 w-4 animate-pulse" />
                Listening...
              </span>
            ) : (
              <span className="text-muted-foreground">Ready</span>
            )}
          </div>

          {/* Live transcript */}
          {transcript && (
            <div className="max-w-xs rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground italic">"{transcript}"</p>
            </div>
          )}

          {/* Voice visualization */}
          <div className={cn(
            "relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300",
            isListening && "bg-emerald-500/20",
            isSpeaking && "bg-primary/20",
            isProcessing && "bg-muted"
          )}>
            <div className={cn(
              "absolute inset-0 rounded-full transition-all duration-300",
              isListening && "animate-ping bg-emerald-500/30",
              isSpeaking && "animate-pulse bg-primary/30"
            )} />
            <div className={cn(
              "relative flex h-16 w-16 items-center justify-center rounded-full",
              isListening && "bg-emerald-500",
              isSpeaking && "bg-primary",
              isProcessing && "bg-muted-foreground",
              !isListening && !isSpeaking && !isProcessing && "bg-muted-foreground/50"
            )}>
              {isProcessing ? (
                <Loader2 className="h-8 w-8 animate-spin text-background" />
              ) : isSpeaking ? (
                <Volume2 className="h-8 w-8 text-background" />
              ) : (
                <Mic className="h-8 w-8 text-background" />
              )}
            </div>
          </div>

          {/* End call button */}
          <Button
            variant="destructive"
            size="lg"
            onClick={endConversation}
            className="mt-4 gap-2"
          >
            <PhoneOff className="h-5 w-5" />
            End Conversation
          </Button>
        </>
      ) : (
        <Button
          variant="default"
          size="lg"
          onClick={startConversation}
          className="gap-2 bg-emerald-500 hover:bg-emerald-600"
        >
          <Phone className="h-5 w-5" />
          Start Voice Chat
        </Button>
      )}
    </div>
  );
}