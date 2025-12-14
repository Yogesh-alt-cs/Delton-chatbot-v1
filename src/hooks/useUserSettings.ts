import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export interface UserSettings {
  id: string;
  user_id: string;
  theme: string;
  notifications_enabled: boolean;
  tts_voice_name: string;
  personalization_name: string | null;
  personalization_style: string;
  voice_language: string;
  created_at: string;
  updated_at: string;
}

export function useUserSettings() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSettings(data as UserSettings);
        // Sync theme from database
        if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system') {
          setTheme(data.theme);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user, setTheme]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<Pick<UserSettings, 'theme' | 'notifications_enabled' | 'tts_voice_name' | 'personalization_name' | 'personalization_style' | 'voice_language'>>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setSettings(prev => prev ? { ...prev, ...updates } : null);
      
      // Sync theme locally
      if (updates.theme && (updates.theme === 'light' || updates.theme === 'dark' || updates.theme === 'system')) {
        setTheme(updates.theme);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const clearAllHistory = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('conversations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error clearing history:', error);
      return false;
    }
  };

  return { settings, loading, updateSettings, clearAllHistory };
}
