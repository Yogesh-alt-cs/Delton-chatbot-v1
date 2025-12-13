import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Menu, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ChatInput } from '@/components/chat/ChatInput';
import { useChat } from '@/hooks/useChat';
import { useFeedback } from '@/hooks/useFeedback';
import { cn } from '@/lib/utils';

export default function Chat() {
  const navigate = useNavigate();
  const { conversationId: urlConversationId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const { messages, isLoading, conversationId, sendMessage, loadConversation, clearChat } = useChat({
    conversationId: urlConversationId,
    onConversationCreated: (conversation) => {
      navigate(`/chat/${conversation.id}`, { replace: true });
    },
  });

  const { feedbackMap, loadFeedback, toggleFeedback } = useFeedback();

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
          <h1 className="font-semibold">
            {conversationId ? 'Chat' : 'New Chat'}
          </h1>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10"
            onClick={handleNewChat}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </header>

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
                Start a conversation by typing a message below. I'm here to help with anything you need!
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
      </div>
    </AppLayout>
  );
}
