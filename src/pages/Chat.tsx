import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Menu, ArrowDown, Phone, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ChatInput } from '@/components/chat/ChatInput';
import { VoiceConversation } from '@/components/chat/VoiceConversation';
import { MicIndicator } from '@/components/chat/MicIndicator';
import { DocumentUpload } from '@/components/chat/DocumentUpload';
import { useChat } from '@/hooks/useChat';
import { useFeedback } from '@/hooks/useFeedback';
import { useReminders } from '@/hooks/useReminders';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function Chat() {
  const navigate = useNavigate();
  const { conversationId: urlConversationId } = useParams();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [isMicActive, setIsMicActive] = useState(false);
  const [personalization, setPersonalization] = useState<{ name: string | null; style: string; language: string }>({ name: null, style: 'balanced', language: 'en-US' });
  const [documentContext, setDocumentContext] = useState<string>('');

  // Initialize reminders hook for parsing AI responses
  const { parseAndCreateReminder } = useReminders();
  const { remainingChats, isLimitReached, incrementUsage, DAILY_LIMIT } = useDailyLimit();
  const { toast } = useToast();

  const { messages, isLoading, conversationId, sendMessage, loadConversation, clearChat } = useChat({
    conversationId: urlConversationId,
    onConversationCreated: (conversation) => {
      navigate(`/chat/${conversation.id}`, { replace: true });
    },
  });

  const { feedbackMap, loadFeedback, toggleFeedback } = useFeedback();

  // Wrapped send with daily limit check
  const handleSendMessage = useCallback(async (content: string, images?: import('@/lib/types').MessageImage[]) => {
    if (isLimitReached) {
      toast({
        title: "Daily limit reached",
        description: `You've used all ${DAILY_LIMIT} chats for today. Your limit resets at midnight.`,
        variant: "destructive",
      });
      return;
    }

    const canProceed = await incrementUsage();
    if (!canProceed) {
      toast({
        title: "Daily limit reached",
        description: `You've used all ${DAILY_LIMIT} chats for today. Your limit resets at midnight.`,
        variant: "destructive",
      });
      return;
    }

    // Append document context if available
    let enrichedContent = content;
    if (documentContext) {
      enrichedContent = content + `\n\n[Document Content]\n${documentContext.slice(0, 8000)}\n[End Document]`;
    }

    await sendMessage(enrichedContent, images);
  }, [isLimitReached, incrementUsage, sendMessage, toast, DAILY_LIMIT, documentContext]);

  // Handle document upload
  const handleDocumentProcessed = useCallback((content: string, fileName: string) => {
    setDocumentContext(content);
    toast({
      title: "Document Ready",
      description: `${fileName} is ready. Ask questions about it!`,
    });
  }, [toast]);

  // Load personalization
  useEffect(() => {
    const loadPersonalization = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('user_settings')
        .select('personalization_name, personalization_style, voice_language')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setPersonalization({
          name: data.personalization_name,
          style: data.personalization_style || 'balanced',
          language: data.voice_language || 'en-US',
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
      <MicIndicator isActive={isMicActive} />
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
              onMicStateChange={setIsMicActive}
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
                  <h2 className="mb-2 text-xl font-semibold">Welcome to Delton 2.0</h2>
                  <p className="max-w-xs text-sm text-muted-foreground mb-4">
                    Start a conversation, upload documents, or switch to voice mode!
                  </p>
                  <DocumentUpload 
                    conversationId={conversationId}
                    onDocumentProcessed={handleDocumentProcessed}
                    disabled={isLoading}
                  />
                </div>
              ) : (
                <div className="py-4">
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={message.id}
                      id={message.id}
                      role={message.role as 'user' | 'assistant'}
                      content={message.content}
                      images={message.images}
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
            <ChatInput onSend={handleSendMessage} disabled={isLoading || isLimitReached} onMicStateChange={setIsMicActive} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
