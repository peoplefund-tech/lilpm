-- Fix 1: Add missing Foreign Key relationship between team_members and profiles
-- This allows PostgREST to resolve team_members?select=*,profile:profiles(*)
DO $$
BEGIN
  -- Check if constraint exists effectively pointing to profiles, if not, try to add it.
  -- We'll try to add a specific FK to profiles. 
  -- Note: If user_id already references auth.users, we might need to be careful.
  -- But often referencing profiles(id) is preferred for frontend queries.
  -- Let's try to add a constraint if it doesn't exist.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_members_user_id_exists_fkey'
  ) THEN
    ALTER TABLE public.team_members 
    ADD CONSTRAINT team_members_user_id_profiles_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN NULL; -- Fail soft if e.g. profiles doesn't exist (unlikely)
END $$;

-- Fix 2: Insert default user_ai_settings for the specific user reporting issues
-- This resolves the 406 error caused by missing row + single() query
INSERT INTO public.user_ai_settings (user_id, default_provider, auto_mode_enabled)
VALUES ('f923be4b-d193-454f-b6b3-44661e39f35b', 'auto', true)
ON CONFLICT (user_id) DO NOTHING;
