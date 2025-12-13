import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Message, Conversation } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface UseChatOptions {
  conversationId?: string;
  onConversationCreated?: (conversation: Conversation) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(options.conversationId);
  const [personalization, setPersonalization] = useState<{ name: string | null; style: string }>({ name: null, style: 'balanced' });
  const { user } = useAuth();
  const { toast } = useToast();

  // Load personalization settings
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

  const loadConversation = useCallback(async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setMessages(data as Message[]);
      setConversationId(convId);
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to load conversation',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const createConversation = useCallback(async (firstMessage: string): Promise<string | null> => {
    if (!user) return null;

    try {
      // Generate title from first message (first 50 chars)
      const title = firstMessage.length > 50 
        ? firstMessage.substring(0, 50) + '...' 
        : firstMessage;

      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title,
        })
        .select()
        .single();

      if (error) throw error;
      
      setConversationId(data.id);
      options.onConversationCreated?.(data as Conversation);
      
      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create conversation',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, toast, options]);

  const saveMessage = useCallback(async (
    convId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<Message | null> => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          role,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Message;
    } catch (error) {
      console.error('Error saving message:', error);
      return null;
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || isLoading) return;

    setIsLoading(true);
    let currentConvId = conversationId;

    try {
      // Create conversation if needed
      if (!currentConvId) {
        currentConvId = await createConversation(content);
        if (!currentConvId) {
          setIsLoading(false);
          return;
        }
      }

      // Add user message to UI immediately
      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversation_id: currentConvId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Save user message to database
      await saveMessage(currentConvId, 'user', content);

      // Prepare messages for AI (excluding system messages from history)
      const chatMessages = [
        // Add personalization as system messages
        ...(personalization.name ? [{ role: 'system' as const, content: `USER_NAME:${personalization.name}` }] : []),
        { role: 'system' as const, content: `USER_STYLE:${personalization.style}` },
        // Add conversation messages
        ...[...messages, userMessage]
          .filter(m => m.role !== 'system')
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      // Stream AI response with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      let response: Response;
      try {
        response = await fetch(CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: chatMessages,
            conversationId: currentConvId,
          }),
          signal: controller.signal,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.');
        }
        throw new Error('Network error. Please check your connection and try again.');
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (response.status === 402) {
          throw new Error('AI credits exhausted. Please add credits to continue.');
        }
        throw new Error(errorData.error || `Request failed. Please try again.`);
      }

      if (!response.body) {
        throw new Error('No response received. Please try again.');
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let textBuffer = '';

      // Add empty assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        conversation_id: currentConvId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });

          // Process line by line
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
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    updated[updated.length - 1] = { ...lastMsg, content: assistantContent };
                  }
                  return updated;
                });
              }
            } catch {
              // Incomplete JSON, put back and wait
              textBuffer = line + '\n' + textBuffer;
              break;
            }
          }
        }
      } catch (streamError) {
        // If we got partial content, keep it and save what we have
        if (assistantContent) {
          console.log('Stream interrupted, saving partial response');
        } else {
          throw new Error('Connection lost. Please try again.');
        }
      }

      // Save assistant message to database
      if (assistantContent) {
        await saveMessage(currentConvId, 'assistant', assistantContent);
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
      
      // Remove the empty assistant message on error
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoading, conversationId, messages, createConversation, saveMessage, toast]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
  }, []);

  return {
    messages,
    isLoading,
    conversationId,
    sendMessage,
    loadConversation,
    clearChat,
  };
}
