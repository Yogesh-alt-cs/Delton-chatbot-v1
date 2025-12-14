import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Menu, ArrowDown, Phone, MessageSquare, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ChatInput } from '@/components/chat/ChatInput';
import { VoiceConversation } from '@/components/chat/VoiceConversation';
import { useChat } from '@/hooks/useChat';
import { useFeedback } from '@/hooks/useFeedback';
import { useWakeWord } from '@/hooks/useWakeWord';
import { useReminders } from '@/hooks/useReminders';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Chat() {
  const navigate = useNavigate();
  const { conversationId: urlConversationId } = useParams();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [personalization, setPersonalization] = useState<{ name: string | null; style: string }>({ name: null, style: 'balanced' });

  // Initialize reminders hook for parsing AI responses
  const { parseAndCreateReminder } = useReminders();

  // Wake word detection
  const { isListening: isWakeWordListening, isSupported: wakeWordSupported } = useWakeWord({
    wakeWord: 'hey delton',
    onWakeWordDetected: () => {
      toast.success('Hey! I heard you! 👋', { duration: 2000 });
      setMode('voice');
      setWakeWordEnabled(false); // Disable wake word while in voice mode
    },
    enabled: wakeWordEnabled && mode === 'text',
  });

  const { messages, isLoading, conversationId, sendMessage, loadConversation, clearChat } = useChat({
    conversationId: urlConversationId,
    onConversationCreated: (conversation) => {
      navigate(`/chat/${conversation.id}`, { replace: true });
    },
  });

  const { feedbackMap, loadFeedback, toggleFeedback } = useFeedback();

  // Load personalization
  useEffect(() => {
    const loadPersonalization = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('user_settings')
        .select('personalization_name, personalization_style')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setPersonalization({
          name: data.personalization_name,
          style: data.personalization_style || 'balanced',
        });
      }
    };
    
    loadPersonalization();
  }, [user]);

  // Load conversation from URL param
  useEffect(() => {
    if (urlConversationId && urlConversationId !== conversationId) {
      loadConversation(urlConversationId);
    }
  }, [urlConversationId, conversationId, loadConversation]);

  // Load feedback when messages change
  useEffect(() => {
    const assistantMessageIds = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.id);
    
    if (assistantMessageIds.length > 0) {
      loadFeedback(assistantMessageIds);
    }
  }, [messages, loadFeedback]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track scroll position
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom && messages.length > 0);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNewChat = () => {
    clearChat();
    navigate('/chat', { replace: true });
  };

  const handleFeedback = useCallback((messageId: string, type: 'like' | 'dislike') => {
    toggleFeedback(messageId, type);
  }, [toggleFeedback]);

  const isLastMessageStreaming = isLoading && messages.length > 0 && 
    messages[messages.length - 1]?.role === 'assistant';

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4 safe-top">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10"
            onClick={() => navigate('/history')}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          {/* Mode Toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <Button
              variant={mode === 'text' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setMode('text')}
              className="h-8 gap-1.5 px-3"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Text</span>
            </Button>
            <Button
              variant={mode === 'voice' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setMode('voice')}
              className="h-8 gap-1.5 px-3"
            >
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Voice</span>
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10"
            onClick={handleNewChat}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </header>

        {mode === 'voice' ? (
          /* Voice Conversation Mode */
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <VoiceConversation
              conversationId={conversationId}
              personalization={personalization}
              onMessage={(role, content) => {
                // Messages are handled internally in VoiceConversation
                console.log(`${role}: ${content}`);
              }}
            />
            <p className="mt-8 max-w-xs text-center text-sm text-muted-foreground">
              Start a voice conversation with Delton. Speak naturally and Delton will respond with voice.
            </p>
          </div>
        ) : (
          <>
            {/* Messages Area */}
            <div 
              ref={scrollContainerRef}
              className="relative flex-1 overflow-y-auto"
              onScroll={handleScroll}
            >
              {messages.length === 0 ? (
                /* Empty State */
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <span className="text-3xl">👋</span>
                  </div>
                  <h2 className="mb-2 text-xl font-semibold">Welcome to Delton</h2>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Start a conversation by typing a message below or switch to voice mode for hands-free chat!
                  </p>
                </div>
              ) : (
                <div className="py-4">
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={message.id}
                      id={message.id}
                      role={message.role as 'user' | 'assistant'}
                      content={message.content}
                      isStreaming={
                        isLastMessageStreaming && 
                        index === messages.length - 1
                      }
                      feedback={feedbackMap[message.id]}
                      onFeedback={handleFeedback}
                      showActions={message.role === 'assistant'}
                    />
                  ))}
                  {isLoading && !isLastMessageStreaming && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* Scroll to bottom button */}
              {showScrollButton && (
                <Button
                  size="icon"
                  variant="secondary"
                  className={cn(
                    "absolute bottom-4 right-4 h-10 w-10 rounded-full shadow-lg",
                    "transition-all hover:scale-105"
                  )}
                  onClick={scrollToBottom}
                >
                  <ArrowDown className="h-5 w-5" />
                </Button>
              )}
            </div>

            {/* Input Area */}
            <ChatInput onSend={sendMessage} disabled={isLoading} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
