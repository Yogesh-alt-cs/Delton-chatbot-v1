import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Message, Conversation, MessageImage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useLongTermMemory } from '@/hooks/useLongTermMemory';

// Use unified-ai for multi-provider support with fallback
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-ai`;
const FIRECRAWL_SCRAPE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/firecrawl-scrape`;
const FIRECRAWL_SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/firecrawl-search`;
const VISION_ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vision-analyze`;
const PROBLEM_SOLVER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/problem-solver`;

interface UseChatOptions {
  conversationId?: string;
  onConversationCreated?: (conversation: Conversation) => void;
}

// Check if a query needs live search
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

// Check if query is a problem-solving request
function isProblemSolvingQuery(query: string): { isProblem: boolean; type: string } {
  const lowerQuery = query.toLowerCase();
  
  const mathPatterns = ['solve', 'calculate', 'compute', 'what is', 'evaluate', 'simplify', 'integrate', 'derive', 'differentiate', '='];
  const physicsPatterns = ['newton', 'force', 'velocity', 'acceleration', 'energy', 'momentum', 'gravity', 'physics'];
  const codingPatterns = ['write code', 'implement', 'algorithm', 'function', 'debug', 'fix this code', 'coding'];
  const logicPatterns = ['prove', 'logic', 'if then', 'deduce', 'infer', 'reasoning'];
  
  if (mathPatterns.some(p => lowerQuery.includes(p)) && /\d/.test(query)) {
    return { isProblem: true, type: 'math' };
  }
  if (physicsPatterns.some(p => lowerQuery.includes(p))) {
    return { isProblem: true, type: 'physics' };
  }
  if (codingPatterns.some(p => lowerQuery.includes(p))) {
    return { isProblem: true, type: 'coding' };
  }
  if (logicPatterns.some(p => lowerQuery.includes(p))) {
    return { isProblem: true, type: 'logic' };
  }
  
  return { isProblem: false, type: 'general' };
}

interface FirecrawlSearchResult {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(options.conversationId);
  const [personalization, setPersonalization] = useState<{ name: string | null; style: string }>({ name: null, style: 'balanced' });
  const { user } = useAuth();
  const { toast } = useToast();
  const { getMemoryContext, extractAndStoreMemories } = useLongTermMemory();

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

  const extractUrls = useCallback((text: string): string[] => {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    return text.match(urlRegex) || [];
  }, []);

  const scrapeUrl = useCallback(async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(FIRECRAWL_SCRAPE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
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

  // Live web search using Firecrawl
  const searchWeb = useCallback(async (query: string): Promise<string | null> => {
    try {
      console.log('Triggering Firecrawl live search for:', query);
      
      const response = await fetch(FIRECRAWL_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query, limit: 5 }),
      });

      if (!response.ok) {
        console.error('Firecrawl search failed:', response.status);
        return null;
      }

      const data = await response.json();
      
      if (!data.success || !data.data || data.data.length === 0) {
        console.log('No search results found');
        return null;
      }

      // Format search results for context
      let formattedResults = '\n\n---\n🔍 **Live Web Search Results:**\n\n';
      
      (data.data as FirecrawlSearchResult[]).slice(0, 5).forEach((result, index) => {
        formattedResults += `**${index + 1}. ${result.title || 'Untitled'}**\n`;
        if (result.description) {
          formattedResults += `${result.description}\n`;
        }
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

  const sendMessage = useCallback(async (content: string, images?: MessageImage[]) => {
    if (!user || isLoading) return;

    setIsLoading(true);
    let currentConvId = conversationId;

    try {
      if (!currentConvId) {
        currentConvId = await createConversation(content);
        if (!currentConvId) {
          setIsLoading(false);
          return;
        }
      }

      // Check for URLs and scrape content
      const urls = extractUrls(content);
      let enrichedContent = content;
      
      if (urls.length > 0) {
        const scrapedContent = await scrapeUrl(urls[0]);
        if (scrapedContent) {
          enrichedContent = content + scrapedContent;
        }
      }

      // Check if we need live web search
      if (needsLiveSearch(content)) {
        const searchResults = await searchWeb(content);
        if (searchResults) {
          enrichedContent = enrichedContent + searchResults;
        }
      }

      // Get long-term memory context
      const memoryContext = await getMemoryContext();
      if (memoryContext) {
        enrichedContent = enrichedContent + memoryContext;
      }

      // Add user message to UI immediately
      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversation_id: currentConvId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        images,
      };
      setMessages((prev) => [...prev, userMessage]);

      await saveMessage(currentConvId, 'user', content);

      // Format message content for vision support
      const formatMessageContent = (text: string, messageImages?: MessageImage[]) => {
        if (!messageImages || messageImages.length === 0) {
          return text;
        }
        
        const parts: any[] = [{ type: 'text', text }];
        
        for (const img of messageImages) {
          if (img.base64) {
            parts.push({
              type: 'image_url',
              image_url: {
                url: `data:${img.mimeType};base64,${img.base64}`,
              },
            });
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
      const timeoutId = setTimeout(() => controller.abort(), 90000); // Increased timeout for multi-provider

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
            userName: personalization.name,
            userStyle: personalization.style,
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
        // Handle known error statuses without throwing (prevents blank-screen runtime errors)
        if (response.status === 402 || response.status === 429) {
          const errorData = await response.json().catch(() => ({} as any));
          const friendlyMessage =
            (errorData as any)?.error ||
            (response.status === 429
              ? 'Delton is a bit busy right now. Please wait a moment and try again.'
              : 'Delton is taking a break. Please try again later.');

          const assistantErrorMessage: Message = {
            id: crypto.randomUUID(),
            conversation_id: currentConvId,
            role: 'assistant',
            content: friendlyMessage,
            created_at: new Date().toISOString(),
          };

          setMessages((prev) => [...prev, assistantErrorMessage]);
          toast({
            title: 'Delton is unavailable',
            description: friendlyMessage,
            variant: 'destructive',
          });
          return;
        }

        const errorData = await response.json().catch(() => ({} as any));
        throw new Error((errorData as any).error || `Something went wrong. Please try again.`);
      }

      if (!response.body) {
        throw new Error('No response received. Please try again.');
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
        if (assistantContent) {
          console.log('Stream interrupted, saving partial response');
        } else {
          throw new Error('Connection lost. Please try again.');
        }
      }

      // Save assistant message and extract memories
      if (assistantContent) {
        await saveMessage(currentConvId, 'assistant', assistantContent);
        // Extract and store memories from conversation
        extractAndStoreMemories(content, assistantContent);
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
      
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
  }, [user, isLoading, conversationId, messages, personalization, createConversation, saveMessage, toast, extractUrls, scrapeUrl, searchWeb, getMemoryContext, extractAndStoreMemories]);

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
