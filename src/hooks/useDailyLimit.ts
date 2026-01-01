import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DAILY_LIMIT = 100;

export const useDailyLimit = () => {
  const { user } = useAuth();
  const [chatCount, setChatCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('daily_chat_usage')
        .select('chat_count')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .maybeSingle();

      if (error) {
        console.error('Error fetching usage:', error);
        return;
      }

      setChatCount(data?.chat_count || 0);
    } catch (err) {
      console.error('Error fetching daily usage:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const incrementUsage = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    const today = new Date().toISOString().split('T')[0];

    try {
      // Check current count first
      const { data: existing } = await supabase
        .from('daily_chat_usage')
        .select('id, chat_count')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .maybeSingle();

      const currentCount = existing?.chat_count || 0;

      if (currentCount >= DAILY_LIMIT) {
        return false; // Limit reached
      }

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('daily_chat_usage')
          .update({ chat_count: currentCount + 1 })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new record for today
        const { error } = await supabase
          .from('daily_chat_usage')
          .insert({
            user_id: user.id,
            usage_date: today,
            chat_count: 1
          });

        if (error) throw error;
      }

      setChatCount(prev => prev + 1);
      return true;
    } catch (err) {
      console.error('Error incrementing usage:', err);
      return true; // Allow on error to not block users
    }
  }, [user]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    chatCount,
    remainingChats: Math.max(0, DAILY_LIMIT - chatCount),
    isLimitReached: chatCount >= DAILY_LIMIT,
    isLoading,
    incrementUsage,
    refreshUsage: fetchUsage,
    DAILY_LIMIT
  };
};
