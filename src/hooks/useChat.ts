import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Message, Conversation, MessageImage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useLongTermMemory } from '@/hooks/useLongTermMemory';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-ai`;
const FIRECRAWL_SCRAPE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/firecrawl-scrape`;
const FIRECRAWL_SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/firecrawl-search`;

interface UseChatOptions {
  conversationId?: string;
  onConversationCreated?: (conversation: Conversation) => void;
}

function needsLiveSearch(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const liveKeywords = [
    'latest', 'current', 'today', 'now', 'recent', 'news',
    'price', 'stock', 'weather', 'score', 'match', 'game',
    'what is happening', 'what happened', 'breaking',
    'trending', 'update', 'live', 'real-time', 'realtime',
    '2025', '2026', 'this week', 'this month', 'yesterday',
    'who won', 'who is', 'what is the', 'how much', 'how many',
  ];
  return liveKeywords.some(keyword => lowerQuery.includes(keyword));
}

interface FirecrawlSearchResult {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
}

export interface ChatError {
  message: string;
  retryContent?: string;
  retryImages?: MessageImage[];
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(options.conversationId);
  const [personalization, setPersonalization] = useState<{ name: string | null; style: string }>({ name: null, style: 'balanced' });
  const [error, setError] = useState<ChatError | null>(null);
  const [wasStopped, setWasStopped] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { getMemoryContext, extractAndStoreMemories } = useLongTermMemory();

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
      toast({ title: 'Error', description: 'Failed to load conversation', variant: 'destructive' });
    }
  }, [toast]);

  const createConversation = useCallback(async (firstMessage: string): Promise<string | null> => {
    if (!user) return null;
    try {
      const title = firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage;
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, title })
        .select()
        .single();
      if (error) throw error;
      setConversationId(data.id);
      options.onConversationCreated?.(data as Conversation);
      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({ title: 'Error', description: 'Failed to create conversation', variant: 'destructive' });
      return null;
    }
  }, [user, toast, options]);

  const saveMessage = useCallback(async (convId: string, role: 'user' | 'assistant', content: string): Promise<Message | null> => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: convId, role, content })
        .select()
        .single();
      if (error) throw error;
      return data as Message;
    } catch (error) {
      console.error('Error saving message:', error);
      return null;
    }
  }, []);

  const extractUrls = useCallback((text: string): string[] => {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    return text.match(urlRegex) || [];
  }, []);

  const scrapeUrl = useCallback(async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(FIRECRAWL_SCRAPE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data?.success && data?.data?.markdown) {
        const title = data.data.metadata?.title || url;
        const content = data.data.markdown.slice(0, 4000);
        return `\n\n---\n📄 **Content from: ${title}**\n${content}\n---\n`;
      }
      return null;
    } catch (err) {
      console.error('URL scrape error:', err);
      return null;
    }
  }, []);

  const searchWeb = useCallback(async (query: string): Promise<string | null> => {
    try {
      const response = await fetch(FIRECRAWL_SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ query, limit: 5 }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.success || !data.data || data.data.length === 0) return null;
      let formattedResults = '\n\n---\n🔍 **Live Web Search Results:**\n\n';
      (data.data as FirecrawlSearchResult[]).slice(0, 5).forEach((result, index) => {
        formattedResults += `**${index + 1}. ${result.title || 'Untitled'}**\n`;
        if (result.description) formattedResults += `${result.description}\n`;
        if (result.markdown) {
          const preview = result.markdown.slice(0, 800);
          formattedResults += `${preview}${result.markdown.length > 800 ? '...' : ''}\n`;
        }
        formattedResults += `Source: ${result.url}\n\n`;
      });
      formattedResults += '---\n';
      return formattedResults;
    } catch (err) {
      console.error('Web search error:', err);
      return null;
    }
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(async (content: string, images?: MessageImage[]) => {
    if (!user || isLoading) return;

    setIsLoading(true);
    setError(null);
    setWasStopped(false);
    let currentConvId = conversationId;

    try {
      if (!currentConvId) {
        currentConvId = await createConversation(content);
        if (!currentConvId) { setIsLoading(false); return; }
      }

      const urls = extractUrls(content);
      let enrichedContent = content;
      if (urls.length > 0) {
        const scrapedContent = await scrapeUrl(urls[0]);
        if (scrapedContent) enrichedContent = content + scrapedContent;
      }
      if (needsLiveSearch(content)) {
        const searchResults = await searchWeb(content);
        if (searchResults) enrichedContent = enrichedContent + searchResults;
      }
      const memoryContext = await getMemoryContext();
      if (memoryContext) enrichedContent = enrichedContent + memoryContext;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversation_id: currentConvId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        images,
      };
      setMessages((prev) => [...prev, userMessage]);
      saveMessage(currentConvId, 'user', content);

      const formatMessageContent = (text: string, messageImages?: MessageImage[]) => {
        if (!messageImages || messageImages.length === 0) return text;
        const parts: any[] = [{ type: 'text', text }];
        for (const img of messageImages) {
          if (img.base64) {
            parts.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
          }
        }
        return parts;
      };

      const chatMessages = [
        ...messages
          .filter(m => m.role !== 'system')
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: formatMessageContent(enrichedContent, images) },
      ];

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort('timeout'), 30000);

      let response: Response;
      try {
        response = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({
            messages: chatMessages,
            conversationId: currentConvId,
            userName: personalization.name,
            userStyle: personalization.style,
          }),
          signal: controller.signal,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          // Check if user-initiated stop vs timeout
          if (controller.signal.reason === 'timeout') {
            setError({ message: 'Request timed out.', retryContent: content, retryImages: images });
          }
          // For user stop, content is saved below
          return;
        }
        setError({ message: 'Network error. Check your connection.', retryContent: content, retryImages: images });
        return;
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Chat response error:', response.status);
        setError({ message: 'Something went wrong.', retryContent: content, retryImages: images });
        return;
      }

      if (!response.body) {
        setError({ message: 'No response received.', retryContent: content, retryImages: images });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let textBuffer = '';

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
              textBuffer = line + '\n' + textBuffer;
              break;
            }
          }
        }
      } catch (streamError) {
        // User-initiated abort during streaming
        if (streamError instanceof Error && streamError.name === 'AbortError') {
          setWasStopped(true);
          if (assistantContent) {
            // Keep partial content
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg?.role === 'assistant') {
                updated[updated.length - 1] = { ...lastMsg, content: assistantContent, stopped: true };
              }
              return updated;
            });
            saveMessage(currentConvId, 'assistant', assistantContent);
          }
          return;
        }
        console.log('Stream handling issue:', streamError);
        if (!assistantContent) {
          assistantContent = "I encountered a brief hiccup. Please try your question again.";
          setMessages((prev) => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg?.role === 'assistant') {
              updated[updated.length - 1] = { ...lastMsg, content: assistantContent };
            }
            return updated;
          });
        }
      }

      if (assistantContent) {
        saveMessage(currentConvId, 'assistant', assistantContent);
        extractAndStoreMemories(content, assistantContent);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setError({ message: 'Something went wrong.', retryContent: content, retryImages: images });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [user, isLoading, conversationId, messages, personalization, createConversation, saveMessage, toast, extractUrls, scrapeUrl, searchWeb, getMemoryContext, extractAndStoreMemories]);

  const retryLastMessage = useCallback(() => {
    if (error?.retryContent) {
      // Remove the last error-related assistant message if empty
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1);
        return prev;
      });
      setError(null);
      // Small delay to let state settle
      setTimeout(() => {
        sendMessage(error.retryContent!, error.retryImages);
      }, 100);
    }
  }, [error, sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
    setWasStopped(false);
  }, []);

  return {
    messages,
    isLoading,
    conversationId,
    error,
    wasStopped,
    sendMessage,
    stopGeneration,
    retryLastMessage,
    loadConversation,
    clearChat,
  };
}
