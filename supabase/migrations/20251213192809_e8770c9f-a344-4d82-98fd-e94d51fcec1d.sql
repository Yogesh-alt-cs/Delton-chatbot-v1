-- Add archive and disappearing message columns to conversations
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Update RLS policy to exclude archived conversations from default view
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;

CREATE POLICY "Users can view their own conversations"
ON public.conversations
FOR SELECT
USING ((auth.uid() = user_id) AND (deleted_at IS NULL) AND (archived_at IS NULL));

-- Create policy for viewing archived conversations
CREATE POLICY "Users can view their archived conversations"
ON public.conversations
FOR SELECT
USING ((auth.uid() = user_id) AND (deleted_at IS NULL) AND (archived_at IS NOT NULL));