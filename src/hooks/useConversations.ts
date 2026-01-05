import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation } from '@/lib/types';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const mountedRef = useRef(true);

  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setArchivedConversations([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Load active conversations (non-archived)
      const { data, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .is('archived_at', null)
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      if (!mountedRef.current) return;
      
      // Filter out expired conversations
      const now = new Date();
      const activeConversations = (data as Conversation[]).filter(conv => {
        if (conv.expires_at) {
          return new Date(conv.expires_at) > now;
        }
        return true;
      });
      
      setConversations(activeConversations);

      // Load archived conversations
      const { data: archived, error: archivedError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });

      if (!archivedError && archived && mountedRef.current) {
        setArchivedConversations(archived as Conversation[]);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
      if (mountedRef.current) {
        setError('Failed to load conversations');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user]);

  const searchConversations = useCallback(async (query: string): Promise<Conversation[]> => {
    if (!user || !query.trim()) {
      return conversations;
    }

    try {
      const searchTerm = query.trim().toLowerCase();
      
      const { data: titleMatches, error: titleError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .is('archived_at', null)
        .ilike('title', `%${searchTerm}%`)
        .order('updated_at', { ascending: false });

      if (titleError) throw titleError;

      const { data: contentMatches, error: contentError } = await supabase
        .from('messages')
        .select('conversation_id')
        .textSearch('content', searchTerm, { type: 'websearch' });

      if (contentError) {
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
              .is('archived_at', null)
              .in('id', convIds)
              .order('updated_at', { ascending: false });

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
          .is('archived_at', null)
          .in('id', convIds)
          .order('updated_at', { ascending: false });

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

  const deleteConversation = useCallback(async (id: string): Promise<boolean> => {
    if (!user) {
      console.error('No user found for delete operation');
      return false;
    }
    
    // Prevent double-delete
    if (deletingIds.has(id)) {
      return false;
    }
    
    // Optimistically remove from UI
    setDeletingIds(prev => new Set(prev).add(id));
    const previousConversations = [...conversations];
    const previousArchived = [...archivedConversations];
    
    setConversations(prev => prev.filter(c => c.id !== id));
    setArchivedConversations(prev => prev.filter(c => c.id !== id));
    
    try {
      console.log('Deleting conversation:', id, 'for user:', user.id);
      
      const { error } = await supabase
        .from('conversations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Supabase error deleting conversation:', error);
        throw error;
      }
      
      console.log('Conversation deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      // Rollback on error
      setConversations(previousConversations);
      setArchivedConversations(previousArchived);
      return false;
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [user, conversations, archivedConversations, deletingIds]);

  const archiveConversation = useCallback(async (id: string) => {
    if (!user) return false;
    
    const archivedConv = conversations.find(c => c.id === id);
    if (!archivedConv) return false;
    
    // Optimistic update
    setConversations(prev => prev.filter(c => c.id !== id));
    setArchivedConversations(prev => [{ ...archivedConv, archived_at: new Date().toISOString() }, ...prev]);
    
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error archiving conversation:', error);
      // Rollback
      setConversations(prev => [archivedConv, ...prev]);
      setArchivedConversations(prev => prev.filter(c => c.id !== id));
      return false;
    }
  }, [user, conversations]);

  const unarchiveConversation = useCallback(async (id: string) => {
    if (!user) return false;
    
    const unarchivedConv = archivedConversations.find(c => c.id === id);
    if (!unarchivedConv) return false;
    
    // Optimistic update
    setArchivedConversations(prev => prev.filter(c => c.id !== id));
    setConversations(prev => [{ ...unarchivedConv, archived_at: null }, ...prev]);
    
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ archived_at: null })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error unarchiving conversation:', error);
      // Rollback
      setArchivedConversations(prev => [unarchivedConv, ...prev]);
      setConversations(prev => prev.filter(c => c.id !== id));
      return false;
    }
  }, [user, archivedConversations]);

  const setConversationExpiry = useCallback(async (id: string, expiresAt: Date | null) => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ expires_at: expiresAt?.toISOString() || null })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setConversations(prev => 
        prev.map(c => c.id === id ? { ...c, expires_at: expiresAt?.toISOString() || null } : c)
      );
      return true;
    } catch (error) {
      console.error('Error setting conversation expiry:', error);
      return false;
    }
  }, [user]);

  // Load on mount and when user changes
  useEffect(() => {
    mountedRef.current = true;
    loadConversations();
    
    return () => {
      mountedRef.current = false;
    };
  }, [loadConversations]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (user && !isLoading) {
        loadConversations();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, isLoading, loadConversations]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Realtime update:', payload);
          // Reload on any change to ensure consistency
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  return {
    conversations,
    archivedConversations,
    isLoading,
    deletingIds,
    error,
    loadConversations,
    searchConversations,
    deleteConversation,
    archiveConversation,
    unarchiveConversation,
    setConversationExpiry,
  };
}
