-- Fix 1: Add missing content column to prd_documents
ALTER TABLE IF EXISTS public.prd_documents 
ADD COLUMN IF NOT EXISTS content TEXT;

-- Fix 2: Ensure user_ai_settings table exists and has correct permissions
CREATE TABLE IF NOT EXISTS public.user_ai_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  anthropic_api_key text,
  openai_api_key text,
  gemini_api_key text,
  default_provider text DEFAULT 'auto',
  auto_mode_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_ai_settings ENABLE ROW LEVEL SECURITY;

-- Create policies (drop first to be idempotent)
DROP POLICY IF EXISTS "Users can view their own ai settings" ON public.user_ai_settings;
DROP POLICY IF EXISTS "Users can insert their own ai settings" ON public.user_ai_settings;
DROP POLICY IF EXISTS "Users can update their own ai settings" ON public.user_ai_settings;
DROP POLICY IF EXISTS "Users can delete their own ai settings" ON public.user_ai_settings;

CREATE POLICY "Users can view their own ai settings"
  ON public.user_ai_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ai settings"
  ON public.user_ai_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai settings"
  ON public.user_ai_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ai settings"
  ON public.user_ai_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Check if user_settings (old table) exists and migrate data if user_ai_settings is empty
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings') THEN
    -- Try to copy data if user_ai_settings doesn't have it
    INSERT INTO public.user_ai_settings (user_id, anthropic_api_key, openai_api_key, gemini_api_key, default_provider, auto_mode_enabled)
    SELECT user_id, anthropic_api_key, openai_api_key, gemini_api_key, default_provider, auto_mode_enabled
    FROM public.user_settings
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;
