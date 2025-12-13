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
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data as Conversation[]);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
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
    deleteConversation,
  };
}
