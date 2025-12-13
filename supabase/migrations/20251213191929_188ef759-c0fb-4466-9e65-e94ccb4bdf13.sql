-- Add TTS voice and personalization columns to user_settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS tts_voice_name text DEFAULT 'default',
ADD COLUMN IF NOT EXISTS personalization_name text,
ADD COLUMN IF NOT EXISTS personalization_style text DEFAULT 'balanced';