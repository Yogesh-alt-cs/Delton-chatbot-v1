-- Add voice_language column to user_settings for voice recognition language preference
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS voice_language TEXT DEFAULT 'en-US';