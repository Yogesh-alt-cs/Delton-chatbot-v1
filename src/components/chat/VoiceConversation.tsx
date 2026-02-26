import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Loader2, PhoneOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useElevenLabsTTS } from '@/hooks/useElevenLabsTTS';
import { VoiceOrb } from './VoiceOrb';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
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
  onMicStateChange?: (isActive: boolean) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export function VoiceConversation({
  onMessage,
  onSaveMessage,
  conversationId,
  personalization = { name: null, style: 'balanced', language: 'en-US' },
  onMicStateChange,
}: VoiceConversationProps) {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  const { toast } = useToast();

  const { speak: elevenLabsSpeak, stop: stopSpeaking, isSpeaking, isLoading: ttsLoading } = useElevenLabsTTS();

  useEffect(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionClass);
  }, []);

  useEffect(() => {
    onMicStateChange?.(isListening);
  }, [isListening, onMicStateChange]);

  const speakText = useCallback(async (text: string): Promise<void> => {
    const success = await elevenLabsSpeak(text);
    if (!success) {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      const voices = speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
        || voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) utterance.voice = englishVoice;
      return new Promise((resolve) => {
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        speechSynthesis.speak(utterance);
      });
    }
  }, [elevenLabsSpeak]);

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
        body: JSON.stringify({ messages: chatMessages, conversationId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 402) throw new Error('Delton is taking a break. Please try again later.');
        throw new Error(errorData.error || 'Something went wrong. Please try again.');
      }

      if (!response.body) throw new Error('No response body');

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
            if (delta) assistantContent += delta;
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
        await speakText(assistantContent);
      }
    } catch (error) {
      console.error('AI error:', error);
      toast({ title: 'Error', description: 'Failed to get AI response', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  }, [messages, conversationId, personalization, onMessage, onSaveMessage, speakText, toast]);

  const startListening = useCallback(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;
    if (isSpeaking || isProcessing) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    const recognition: ISpeechRecognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = personalization.language || 'en-US';

    let finalTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimTranscript(interim);
      if (finalTranscript.trim()) {
        setTranscript(finalTranscript.trim());
        setInterimTranscript('');
        const messageToSend = finalTranscript.trim();
        finalTranscript = '';
        sendToAI(messageToSend);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setInterimTranscript('');
      if (event.error === 'no-speech') {
        if (shouldRestartRef.current && !isProcessing && !isSpeaking) {
          setTimeout(() => { if (shouldRestartRef.current) startListening(); }, 300);
        }
      } else if (event.error === 'audio-capture') {
        toast({ title: 'Microphone Busy', description: 'Another app is using your microphone.', variant: 'destructive' });
        shouldRestartRef.current = false;
        setIsActive(false);
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast({ title: 'Microphone Blocked', description: 'Please allow microphone access.', variant: 'destructive' });
        shouldRestartRef.current = false;
        setIsActive(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (shouldRestartRef.current && !isProcessing && !isSpeaking) {
        setTimeout(() => { if (shouldRestartRef.current && !isProcessing && !isSpeaking) startListening(); }, 300);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      setInterimTranscript('');
    } catch {
      setIsListening(false);
      if (shouldRestartRef.current) {
        setTimeout(() => { if (shouldRestartRef.current) startListening(); }, 500);
      }
    }
  }, [isSpeaking, isProcessing, sendToAI, toast, personalization.language]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const startConversation = useCallback(() => {
    setIsActive(true);
    shouldRestartRef.current = true;
    startListening();
  }, [startListening]);

  const endConversation = useCallback(() => {
    shouldRestartRef.current = false;
    stopListening();
    stopSpeaking();
    setIsActive(false);
    setMessages([]);
    setTranscript('');
    setInterimTranscript('');
  }, [stopListening, stopSpeaking]);

  if (!isSupported) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/50 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Voice mode isn't supported in this browser. Please try Chrome.
        </p>
      </div>
    );
  }

  const displayText = interimTranscript || transcript;
  const statusLabel = isListening
    ? 'Listening...'
    : isProcessing || ttsLoading
    ? 'Thinking...'
    : isSpeaking
    ? 'Speaking...'
    : 'Tap to start';

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-md">
      <AnimatePresence mode="wait">
        {isActive ? (
          <motion.div
            key="active"
            className="flex flex-col items-center gap-6 w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Voice Orb */}
            <VoiceOrb
              isListening={isListening}
              isSpeaking={isSpeaking}
              isProcessing={isProcessing || ttsLoading}
              size={180}
            />

            {/* Status label */}
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={statusLabel}
            >
              {isListening && (
                <motion.span
                  className="h-2 w-2 rounded-full bg-primary"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
              {(isProcessing || ttsLoading) && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {isSpeaking && (
                <Volume2 className="h-4 w-4 text-primary animate-pulse" />
              )}
              <span className={cn(
                'text-sm font-medium',
                isListening ? 'text-primary' : 'text-muted-foreground'
              )}>
                {statusLabel}
              </span>
            </motion.div>

            {/* Live transcript */}
            <AnimatePresence>
              {displayText && (
                <motion.div
                  className="w-full rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 text-center"
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: 10, height: 0 }}
                >
                  <p className="text-base font-medium text-foreground">
                    "{displayText}"
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* End button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                size="lg"
                variant="destructive"
                onClick={endConversation}
                className="rounded-full px-8 gap-2"
              >
                <PhoneOff className="h-4 w-4" />
                End
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="inactive"
            className="flex flex-col items-center gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Idle orb - tappable to start */}
            <motion.button
              onClick={startConversation}
              className="relative focus:outline-none"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <VoiceOrb
                isListening={false}
                isSpeaking={false}
                isProcessing={false}
                size={160}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Mic className="h-8 w-8 text-muted-foreground/70" />
              </div>
            </motion.button>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-foreground">Voice Mode</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Tap the orb to start a voice conversation with Delton
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
