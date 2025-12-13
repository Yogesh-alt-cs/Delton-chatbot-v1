import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation } from '@/lib/types';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data as Conversation[]);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const searchConversations = useCallback(async (query: string): Promise<Conversation[]> => {
    if (!user || !query.trim()) {
      return conversations;
    }

    try {
      // Search in both titles and message content
      const searchTerm = query.trim().toLowerCase();
      
      // First, search by title
      const { data: titleMatches, error: titleError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .ilike('title', `%${searchTerm}%`)
        .order('updated_at', { ascending: false });

      if (titleError) throw titleError;

      // Then, search by message content using full-text search
      const { data: contentMatches, error: contentError } = await supabase
        .from('messages')
        .select('conversation_id')
        .textSearch('content', searchTerm, { type: 'websearch' });

      if (contentError) {
        // Fallback to ilike if full-text search fails
        const { data: fallbackMatches } = await supabase
          .from('messages')
          .select('conversation_id')
          .ilike('content', `%${searchTerm}%`);
        
        if (fallbackMatches) {
          const convIds = [...new Set(fallbackMatches.map(m => m.conversation_id))];
          
          if (convIds.length > 0) {
            const { data: convs } = await supabase
              .from('conversations')
              .select('*')
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .in('id', convIds)
              .order('updated_at', { ascending: false });

            // Merge and dedupe results
            const allMatches = [...(titleMatches || []), ...(convs || [])];
            const unique = allMatches.filter((conv, idx, arr) => 
              arr.findIndex(c => c.id === conv.id) === idx
            );
            return unique as Conversation[];
          }
        }
      } else if (contentMatches && contentMatches.length > 0) {
        const convIds = [...new Set(contentMatches.map(m => m.conversation_id))];
        
        const { data: convs } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .in('id', convIds)
          .order('updated_at', { ascending: false });

        // Merge and dedupe results
        const allMatches = [...(titleMatches || []), ...(convs || [])];
        const unique = allMatches.filter((conv, idx, arr) => 
          arr.findIndex(c => c.id === conv.id) === idx
        );
        return unique as Conversation[];
      }

      return titleMatches as Conversation[];
    } catch (error) {
      console.error('Error searching conversations:', error);
      return conversations.filter(c => 
        c.title.toLowerCase().includes(query.toLowerCase())
      );
    }
  }, [user, conversations]);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      // Soft delete
      const { error } = await supabase
        .from('conversations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      setConversations((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    isLoading,
    loadConversations,
    searchConversations,
    deleteConversation,
  };
}
