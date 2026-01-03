import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type MemoryType = 'profile' | 'preference' | 'context' | 'episodic';

export interface Memory {
  id: string;
  memory_type: MemoryType;
  key: string;
  value: string;
  metadata: Record<string, unknown>;
  importance: number;
  created_at: string;
  updated_at: string;
  accessed_at: string;
}

export function useLongTermMemory() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Store a memory
  const storeMemory = useCallback(async (
    memoryType: MemoryType,
    key: string,
    value: string,
    metadata: Record<string, unknown> = {},
    importance: number = 5
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // First try to find existing memory
      const { data: existing } = await supabase
        .from('user_memories')
        .select('id')
        .eq('user_id', user.id)
        .eq('memory_type', memoryType)
        .eq('key', key)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('user_memories')
          .update({
            value,
            metadata: metadata as any,
            importance,
            accessed_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('user_memories')
          .insert({
            user_id: user.id,
            memory_type: memoryType,
            key,
            value,
            metadata: metadata as any,
            importance,
          });
        
        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error storing memory:', error);
      return false;
    }
  }, [user]);

  // Retrieve memories by type
  const getMemories = useCallback(async (
    memoryType?: MemoryType,
    limit: number = 20
  ): Promise<Memory[]> => {
    if (!user) return [];

    try {
      let query = supabase
        .from('user_memories')
        .select('*')
        .eq('user_id', user.id)
        .order('importance', { ascending: false })
        .order('accessed_at', { ascending: false })
        .limit(limit);

      if (memoryType) {
        query = query.eq('memory_type', memoryType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Memory[];
    } catch (error) {
      console.error('Error fetching memories:', error);
      return [];
    }
  }, [user]);

  // Get a specific memory by key
  const getMemory = useCallback(async (
    memoryType: MemoryType,
    key: string
  ): Promise<Memory | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('user_memories')
        .select('*')
        .eq('user_id', user.id)
        .eq('memory_type', memoryType)
        .eq('key', key)
        .maybeSingle();

      if (error) throw error;

      // Update accessed_at
      if (data) {
        await supabase
          .from('user_memories')
          .update({ accessed_at: new Date().toISOString() })
          .eq('id', data.id);
      }

      return data as Memory | null;
    } catch (error) {
      console.error('Error fetching memory:', error);
      return null;
    }
  }, [user]);

  // Delete a memory
  const deleteMemory = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('user_memories')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting memory:', error);
      return false;
    }
  }, [user]);

  // Get all memories formatted for AI context
  const getMemoryContext = useCallback(async (): Promise<string> => {
    if (!user) return '';

    setIsLoading(true);
    try {
      const memories = await getMemories(undefined, 30);
      
      if (memories.length === 0) return '';

      const grouped = memories.reduce((acc, mem) => {
        if (!acc[mem.memory_type]) acc[mem.memory_type] = [];
        acc[mem.memory_type].push(mem);
        return acc;
      }, {} as Record<string, Memory[]>);

      let context = '\n\n[USER MEMORY CONTEXT]\n';

      if (grouped.profile?.length) {
        context += '\nProfile:\n';
        grouped.profile.forEach(m => {
          context += `- ${m.key}: ${m.value}\n`;
        });
      }

      if (grouped.preference?.length) {
        context += '\nPreferences:\n';
        grouped.preference.forEach(m => {
          context += `- ${m.key}: ${m.value}\n`;
        });
      }

      if (grouped.episodic?.length) {
        context += '\nRecent Context:\n';
        grouped.episodic.slice(0, 5).forEach(m => {
          context += `- ${m.key}: ${m.value}\n`;
        });
      }

      context += '[END MEMORY CONTEXT]\n';

      return context;
    } catch (error) {
      console.error('Error getting memory context:', error);
      return '';
    } finally {
      setIsLoading(false);
    }
  }, [user, getMemories]);

  // Extract and store memories from conversation
  const extractAndStoreMemories = useCallback(async (
    userMessage: string,
    assistantResponse: string
  ): Promise<void> => {
    if (!user) return;

    // Simple pattern matching for memory extraction
    const patterns = [
      { regex: /my name is (\w+)/i, type: 'profile' as MemoryType, key: 'name' },
      { regex: /i am a[n]? (.+?)(?:\.|,|$)/i, type: 'profile' as MemoryType, key: 'role' },
      { regex: /i work (?:at|for|in) (.+?)(?:\.|,|$)/i, type: 'profile' as MemoryType, key: 'workplace' },
      { regex: /i prefer (.+?)(?:\.|,|$)/i, type: 'preference' as MemoryType, key: 'preference' },
      { regex: /i like (.+?)(?:\.|,|$)/i, type: 'preference' as MemoryType, key: 'likes' },
      { regex: /remind me (?:to|about) (.+?)(?:\.|,|$)/i, type: 'episodic' as MemoryType, key: 'reminder' },
    ];

    for (const pattern of patterns) {
      const match = userMessage.match(pattern.regex);
      if (match && match[1]) {
        const value = match[1].trim();
        if (value.length > 2 && value.length < 200) {
          await storeMemory(pattern.type, pattern.key, value, {
            source: 'conversation',
            extractedAt: new Date().toISOString(),
          });
        }
      }
    }
  }, [user, storeMemory]);

  return {
    isLoading,
    storeMemory,
    getMemories,
    getMemory,
    deleteMemory,
    getMemoryContext,
    extractAndStoreMemories,
  };
}
