-- Migration: User deletion cascade and realtime setup
-- When a user is deleted from profiles, automatically remove them from all teams

-- Step 1: Ensure team_members has CASCADE DELETE on user_id
DO $$ 
BEGIN
  -- Drop existing foreign key if exists
  ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;
  
  -- Recreate with CASCADE DELETE
  ALTER TABLE team_members 
    ADD CONSTRAINT team_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;
    
  RAISE NOTICE 'team_members_user_id_fkey updated with CASCADE DELETE';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating team_members constraint: %', SQLERRM;
END $$;

-- Step 2: Enable realtime for team_members table
-- This allows clients to subscribe to INSERT, UPDATE, DELETE events
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;

-- Step 3: Also ensure related tables cascade properly
-- When a team is deleted, remove all members
DO $$ 
BEGIN
  ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_team_id_fkey;
  
  ALTER TABLE team_members 
    ADD CONSTRAINT team_members_team_id_fkey 
    FOREIGN KEY (team_id) 
    REFERENCES teams(id) 
    ON DELETE CASCADE;
    
  RAISE NOTICE 'team_members_team_id_fkey updated with CASCADE DELETE';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating team_members team constraint: %', SQLERRM;
END $$;

-- Step 4: When user is deleted from auth.users, also delete from profiles
-- This is typically handled by Supabase Auth, but ensure profiles cascade to auth.users
-- Note: We can't modify auth.users directly, but profiles should be deleted when auth user is deleted

-- Create a trigger function to notify about member deletions
CREATE OR REPLACE FUNCTION notify_team_member_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM pg_notify('team_member_deleted', json_build_object(
      'id', OLD.id,
      'team_id', OLD.team_id,
      'user_id', OLD.user_id
    )::text);
    RETURN OLD;
  ELSIF (TG_OP = 'INSERT') THEN
    PERFORM pg_notify('team_member_added', json_build_object(
      'id', NEW.id,
      'team_id', NEW.team_id,
      'user_id', NEW.user_id
    )::text);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger
DROP TRIGGER IF EXISTS on_team_member_change ON team_members;
CREATE TRIGGER on_team_member_change
  AFTER INSERT OR DELETE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_team_member_change();
