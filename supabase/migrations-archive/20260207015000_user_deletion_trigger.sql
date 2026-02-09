-- ============================================================================
-- Migration: User Deletion Trigger (Definitive Fix)
-- ============================================================================
-- The issue: Supabase auth.users deletion fails because profiles table 
-- references auth.users and CASCADE doesn't work properly on auth schema.
--
-- Solution: Create a trigger that runs BEFORE user deletion in auth.users
-- to manually delete the profile first, then allow the auth deletion.
-- ============================================================================

-- First, let's ensure profiles.id FK has proper CASCADE
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
  
  -- Recreate with CASCADE - this should already exist but let's be sure
  ALTER TABLE profiles 
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  
  RAISE NOTICE 'profiles_id_fkey constraint updated to CASCADE';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update profiles constraint: %', SQLERRM;
END $$;

-- Create a function to handle user deletion cascade
CREATE OR REPLACE FUNCTION handle_user_deletion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete profile first (this will cascade to team_members, etc.)
  DELETE FROM profiles WHERE id = OLD.id;
  
  -- Return OLD to allow the deletion to proceed
  RETURN OLD;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Create trigger that fires BEFORE DELETE on auth.users
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_deletion();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_user_deletion() TO service_role;

-- Also ensure all tables with user references have proper CASCADE
-- This is a comprehensive fix for any remaining issues

-- team_members
DO $$
BEGIN
  ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;
  ALTER TABLE team_members 
    ADD CONSTRAINT team_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  RAISE NOTICE 'team_members FK updated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'team_members FK error: %', SQLERRM;
END $$;

-- issues (assignee_id, created_by)
DO $$
BEGIN
  ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_assignee_id_fkey;
  ALTER TABLE issues 
    ADD CONSTRAINT issues_assignee_id_fkey 
    FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  RAISE NOTICE 'issues assignee_id FK updated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'issues assignee_id FK error: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_created_by_fkey;
  ALTER TABLE issues 
    ADD CONSTRAINT issues_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  RAISE NOTICE 'issues created_by FK updated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'issues created_by FK error: %', SQLERRM;
END $$;

-- prd_documents
DO $$
BEGIN
  ALTER TABLE prd_documents DROP CONSTRAINT IF EXISTS prd_documents_created_by_fkey;
  ALTER TABLE prd_documents 
    ADD CONSTRAINT prd_documents_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  RAISE NOTICE 'prd_documents created_by FK updated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'prd_documents FK error: %', SQLERRM;
END $$;

-- projects
DO $$
BEGIN
  ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
  ALTER TABLE projects 
    ADD CONSTRAINT projects_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  RAISE NOTICE 'projects created_by FK updated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'projects FK error: %', SQLERRM;
END $$;

-- team_invites
DO $$
BEGIN
  ALTER TABLE team_invites DROP CONSTRAINT IF EXISTS team_invites_invited_by_fkey;
  ALTER TABLE team_invites 
    ADD CONSTRAINT team_invites_invited_by_fkey 
    FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  RAISE NOTICE 'team_invites FK updated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'team_invites FK error: %', SQLERRM;
END $$;

-- activity_logs
DO $$
BEGIN
  ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
  ALTER TABLE activity_logs 
    ADD CONSTRAINT activity_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  RAISE NOTICE 'activity_logs FK updated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'activity_logs FK error: %', SQLERRM;
END $$;

-- lily_conversations
DO $$
BEGIN
  ALTER TABLE lily_conversations DROP CONSTRAINT IF EXISTS lily_conversations_user_id_fkey;
  ALTER TABLE lily_conversations 
    ADD CONSTRAINT lily_conversations_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  RAISE NOTICE 'lily_conversations FK updated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'lily_conversations FK error: %', SQLERRM;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ User deletion trigger and all FK constraints have been updated.';
END $$;
