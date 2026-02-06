-- Create notifications table if not exists
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL, -- e.g., 'invite_received', 'issue_assigned', 'mention', etc.
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);
  
-- Allow Service Role and Triggers to insert notifications
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true); -- Triggers/Functions bypass RLS, but this allows explicit inserts if needed

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Trigger Function: Create notification when invited
CREATE OR REPLACE FUNCTION public.handle_new_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id uuid;
  inviter_name text;
  team_name text;
BEGIN
  -- Find if the invited email belongs to an existing user
  SELECT id INTO target_user_id
  FROM public.profiles
  WHERE email = NEW.email;

  -- If user exists, create notification
  IF target_user_id IS NOT NULL THEN
    -- Get inviter name
    SELECT coalesce(full_name, email) INTO inviter_name
    FROM public.profiles
    WHERE id = NEW.invited_by;

    -- Get team name
    SELECT name INTO team_name
    FROM public.teams
    WHERE id = NEW.team_id;

    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    ) VALUES (
      target_user_id,
      'invite_received',
      'New Team Invitation',
      coalesce(inviter_name, 'Someone') || ' invited you to join ' || coalesce(team_name, 'a team'),
      jsonb_build_object(
        'invite_id', NEW.id,
        'team_id', NEW.team_id,
        'token', NEW.token,
        'role', NEW.role
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: On new invite
DROP TRIGGER IF EXISTS on_invite_created ON public.team_invites;
CREATE TRIGGER on_invite_created
  AFTER INSERT ON public.team_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_invite();
