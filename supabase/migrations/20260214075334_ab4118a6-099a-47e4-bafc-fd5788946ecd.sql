-- Drop the existing update policy that has a WITH CHECK clause causing issues
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;

-- Recreate without WITH CHECK so soft-delete (setting deleted_at) works
CREATE POLICY "Users can update their own conversations"
ON public.conversations
FOR UPDATE
USING (auth.uid() = user_id);