import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { usePushNotifications } from './usePushNotifications';

export interface Reminder {
  id: string;
  user_id: string;
  conversation_id?: string;
  message_id?: string;
  title: string;
  description?: string;
  remind_at: string;
  is_completed: boolean;
  created_at: string;
}

export function useReminders() {
  const { user } = useAuth();
  const { sendNotification, isEnabled: notificationsEnabled } = usePushNotifications();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadReminders = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .order('remind_at', { ascending: true });

      if (error) throw error;
      setReminders((data as Reminder[]) || []);
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const createReminder = useCallback(async (
    title: string,
    remindAt: Date,
    description?: string,
    conversationId?: string,
    messageId?: string
  ): Promise<Reminder | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          title,
          description,
          remind_at: remindAt.toISOString(),
          conversation_id: conversationId,
          message_id: messageId,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Reminder set!', {
        description: `I'll remind you: "${title}" at ${remindAt.toLocaleString()}`,
      });
      
      await loadReminders();
      return data as Reminder;
    } catch (error) {
      console.error('Error creating reminder:', error);
      toast.error('Failed to create reminder');
      return null;
    }
  }, [user, loadReminders]);

  const completeReminder = useCallback(async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: true })
        .eq('id', reminderId);

      if (error) throw error;
      await loadReminders();
    } catch (error) {
      console.error('Error completing reminder:', error);
    }
  }, [loadReminders]);

  const deleteReminder = useCallback(async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;
      await loadReminders();
      toast.success('Reminder deleted');
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast.error('Failed to delete reminder');
    }
  }, [loadReminders]);

  // Parse reminder from AI response
  const parseAndCreateReminder = useCallback(async (
    response: string,
    conversationId?: string,
    messageId?: string
  ) => {
    const reminderRegex = /\[REMINDER:\s*title="([^"]+)"\s*time="([^"]+)"\]/g;
    let match;

    while ((match = reminderRegex.exec(response)) !== null) {
      const title = match[1];
      const timeStr = match[2];
      
      try {
        const remindAt = new Date(timeStr);
        if (!isNaN(remindAt.getTime()) && remindAt > new Date()) {
          await createReminder(title, remindAt, undefined, conversationId, messageId);
        }
      } catch (error) {
        console.error('Error parsing reminder time:', error);
      }
    }
  }, [createReminder]);

  // Check for due reminders and send notifications
  const checkDueReminders = useCallback(async () => {
    if (!user) return;
    
    const now = new Date();
    const dueReminders = reminders.filter(reminder => {
      const remindAt = new Date(reminder.remind_at);
      return remindAt <= now && !reminder.is_completed;
    });

    for (const reminder of dueReminders) {
      // Send push notification if enabled
      if (notificationsEnabled) {
        sendNotification('Delton Reminder 🔔', {
          body: reminder.title,
          icon: '/icon-192.png',
          tag: reminder.id,
        });
      }
      
      // Show toast
      toast.info('🔔 Reminder!', {
        description: reminder.title,
        duration: 10000,
      });
      
      // Mark as completed
      await completeReminder(reminder.id);
    }
  }, [user, reminders, completeReminder, notificationsEnabled, sendNotification]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  // Check for due reminders every 30 seconds
  useEffect(() => {
    const interval = setInterval(checkDueReminders, 30000);
    checkDueReminders(); // Initial check
    return () => clearInterval(interval);
  }, [checkDueReminders]);

  return {
    reminders,
    isLoading,
    createReminder,
    completeReminder,
    deleteReminder,
    parseAndCreateReminder,
    loadReminders,
  };
}
