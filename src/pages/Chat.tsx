import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Menu, ArrowDown, Phone, MessageCircle, Download, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { MicIndicator } from '@/components/chat/MicIndicator';
import { useChat } from '@/hooks/useChat';
import { useExportData } from '@/hooks/useExportData';
import { useFeedback } from '@/hooks/useFeedback';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Lazy load heavy components not needed on initial render
const VoiceConversation = lazy(() => import('@/components/chat/VoiceConversation').then(m => ({ default: m.VoiceConversation })));
const DocumentUpload = lazy(() => import('@/components/chat/DocumentUpload').then(m => ({ default: m.DocumentUpload })));

export default function Chat() {
  const navigate = useNavigate();
  const { conversationId: urlConversationId } = useParams();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [isMicActive, setIsMicActive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [documentContext, setDocumentContext] = useState<string>('');

  const { exportSingleConversation } = useExportData();
  const { remainingChats, isLimitReached, incrementUsage, DAILY_LIMIT } = useDailyLimit();
  const { toast } = useToast();

  const { messages, isLoading, conversationId, sendMessage, loadConversation, clearChat } = useChat({
    conversationId: urlConversationId,
    onConversationCreated: (conversation) => {
      navigate(`/chat/${conversation.id}`, { replace: true });
    }
  });

  const { feedbackMap, loadFeedback, toggleFeedback } = useFeedback();

  const handleSendMessage = useCallback(async (content: string, images?: import('@/lib/types').MessageImage[]) => {
    if (isLimitReached) {
      toast({
        title: "Daily limit reached",
        description: `You've used all ${DAILY_LIMIT} chats for today. Your limit resets at midnight.`,
        variant: "destructive"
      });
      return;
    }

    const canProceed = await incrementUsage();
    if (!canProceed) {
      toast({
        title: "Daily limit reached",
        description: `You've used all ${DAILY_LIMIT} chats for today. Your limit resets at midnight.`,
        variant: "destructive"
      });
      return;
    }

    let enrichedContent = content;
    if (documentContext) {
      enrichedContent = content + `\n\n[Document Content]\n${documentContext.slice(0, 8000)}\n[End Document]`;
    }

    await sendMessage(enrichedContent, images);
  }, [isLimitReached, incrementUsage, sendMessage, toast, DAILY_LIMIT, documentContext]);

  const handleDocumentProcessed = useCallback((content: string, fileName: string) => {
    setDocumentContext(content);
    toast({
      title: "Document Ready",
      description: `${fileName} is ready. Ask questions about it!`
    });
  }, [toast]);

  useEffect(() => {
    if (urlConversationId && urlConversationId !== conversationId) {
      loadConversation(urlConversationId);
    }
  }, [urlConversationId, conversationId, loadConversation]);

  useEffect(() => {
    const assistantMessageIds = messages
      .filter((m) => m.role === 'assistant')
      .map((m) => m.id);
    if (assistantMessageIds.length > 0) {
      loadFeedback(assistantMessageIds);
    }
  }, [messages, loadFeedback]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <div className="flex h-screen bg-background">
      <MicIndicator isActive={isMicActive} />

      <ChatSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-top shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-10 w-10 lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold text-sm hidden sm:inline">Delton AI</span>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-muted/50 p-1">
            <Button variant={mode === 'text' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMode('text')} className="h-8 gap-1.5 px-3 rounded-full text-xs">
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Text</span>
            </Button>
            <Button variant={mode === 'voice' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMode('voice')} className="h-8 gap-1.5 px-3 rounded-full text-xs">
              <Phone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Voice</span>
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {conversationId && (
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => exportSingleConversation(conversationId, 'pdf')} title="Download as PDF">
                <Download className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-10 w-10 hidden lg:flex" onClick={() => navigate('/settings')} title="Settings">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={handleNewChat}>
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {mode === 'voice' ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-primary" />}>
              <VoiceConversation
                conversationId={conversationId}
                personalization={{ name: null, style: 'balanced', language: 'en-US' }}
                onMicStateChange={setIsMicActive}
                onMessage={(role, content) => console.log(`${role}: ${content}`)}
              />
            </Suspense>
          </div>
        ) : (
          <>
            <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto" onScroll={handleScroll}>
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <h2 className="mb-2 text-2xl font-semibold">How can I help you today?</h2>
                  <p className="max-w-md text-sm text-muted-foreground mb-6">
                    I can answer questions, help with analysis, write content, and much more. Upload documents or just start typing.
                  </p>
                  <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}>
                    <DocumentUpload
                      conversationId={conversationId}
                      onDocumentProcessed={handleDocumentProcessed}
                      disabled={isLoading}
                    />
                  </Suspense>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl py-4">
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={message.id}
                      id={message.id}
                      role={message.role as 'user' | 'assistant'}
                      content={message.content}
                      images={message.images}
                      isStreaming={isLastMessageStreaming && index === messages.length - 1}
                      feedback={feedbackMap[message.id]}
                      onFeedback={handleFeedback}
                      showActions={message.role === 'assistant'}
                    />
                  ))}
                  {isLoading && !isLastMessageStreaming && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {showScrollButton && (
                <Button
                  size="icon"
                  variant="secondary"
                  className={cn(
                    "absolute bottom-4 left-1/2 -translate-x-1/2 h-9 w-9 rounded-full shadow-lg border border-border",
                    "transition-all hover:scale-105"
                  )}
                  onClick={scrollToBottom}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="shrink-0 border-t border-border bg-background safe-bottom">
              <div className="mx-auto max-w-3xl">
                <ChatInput onSend={handleSendMessage} disabled={isLoading || isLimitReached} onMicStateChange={setIsMicActive} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
