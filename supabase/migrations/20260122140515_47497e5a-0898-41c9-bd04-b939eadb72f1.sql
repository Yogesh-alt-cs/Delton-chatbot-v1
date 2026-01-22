-- Create PRD history table for saving generated PRDs
CREATE TABLE public.prd_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  product_name TEXT NOT NULL,
  template_type TEXT,
  content TEXT NOT NULL,
  form_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prd_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own PRDs" 
ON public.prd_history FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own PRDs" 
ON public.prd_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PRDs" 
ON public.prd_history FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PRDs" 
ON public.prd_history FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_prd_history_updated_at
BEFORE UPDATE ON public.prd_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();