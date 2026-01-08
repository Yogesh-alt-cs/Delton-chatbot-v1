-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;

-- Create new UPDATE policy with proper WITH CHECK clause
-- This allows users to update their own conversations, including soft-delete
CREATE POLICY "Users can update their own conversations" 
ON public.conversations 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);