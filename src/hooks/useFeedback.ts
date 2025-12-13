import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Feedback } from '@/lib/types';

export function useFeedback() {
  const [feedbackMap, setFeedbackMap] = useState<Record<string, Feedback>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const loadFeedback = useCallback(async (messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('user_id', user.id)
        .in('message_id', messageIds);

      if (error) throw error;

      const map: Record<string, Feedback> = {};
      data?.forEach((fb) => {
        map[fb.message_id] = fb as Feedback;
      });
      setFeedbackMap(map);
    } catch (error) {
      console.error('Error loading feedback:', error);
    }
  }, [user]);

  const toggleFeedback = useCallback(async (
    messageId: string, 
    type: 'like' | 'dislike'
  ): Promise<boolean> => {
    if (!user) return false;
    setIsLoading(true);

    try {
      const existing = feedbackMap[messageId];

      if (existing) {
        if (existing.type === type) {
          // Remove feedback
          const { error } = await supabase
            .from('feedback')
            .delete()
            .eq('id', existing.id);

          if (error) throw error;

          setFeedbackMap((prev) => {
            const updated = { ...prev };
            delete updated[messageId];
            return updated;
          });
        } else {
          // Update feedback type
          const { data, error } = await supabase
            .from('feedback')
            .update({ type })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) throw error;

          setFeedbackMap((prev) => ({
            ...prev,
            [messageId]: data as Feedback,
          }));
        }
      } else {
        // Create new feedback
        const { data, error } = await supabase
          .from('feedback')
          .insert({
            message_id: messageId,
            user_id: user.id,
            type,
          })
          .select()
          .single();

        if (error) throw error;

        setFeedbackMap((prev) => ({
          ...prev,
          [messageId]: data as Feedback,
        }));
      }

      return true;
    } catch (error) {
      console.error('Error toggling feedback:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, feedbackMap]);

  return {
    feedbackMap,
    isLoading,
    loadFeedback,
    toggleFeedback,
  };
}
