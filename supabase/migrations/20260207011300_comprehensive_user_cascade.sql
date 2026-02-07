-- ============================================================================
-- Migration: Comprehensive User Deletion CASCADE Fix
-- ============================================================================
-- This migration ensures ALL foreign key constraints pointing to auth.users
-- have ON DELETE CASCADE, allowing Supabase Dashboard to delete users cleanly.
--
-- IMPORTANT FOR FUTURE DEVELOPMENT:
-- When creating new tables with user_id or any reference to auth.users,
-- ALWAYS use: REFERENCES auth.users(id) ON DELETE CASCADE
-- ============================================================================

-- 1. profiles table - main user profile
-- The profiles table references auth.users(id) and should cascade delete
DO $$ 
BEGIN
  -- Drop and recreate the constraint with CASCADE
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
  
  ALTER TABLE profiles 
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
    
  RAISE NOTICE 'profiles_id_fkey updated with CASCADE DELETE';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating profiles constraint: %', SQLERRM;
END $$;

-- 2. teams table - owner reference
DO $$ 
BEGIN
  ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_owner_id_fkey;
  
  ALTER TABLE teams 
    ADD CONSTRAINT teams_owner_id_fkey 
    FOREIGN KEY (owner_id) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;
    
  RAISE NOTICE 'teams_owner_id_fkey updated with SET NULL on delete';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating teams owner constraint: %', SQLERRM;
END $$;

-- 3. team_members table - user reference
DO $$ 
BEGIN
  -- Note: This references profiles(id), not auth.users directly
  -- profiles already cascades from auth.users, so this continues the chain
  ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;
  
  ALTER TABLE team_members 
    ADD CONSTRAINT team_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;
    
  RAISE NOTICE 'team_members_user_id_fkey updated with CASCADE DELETE';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating team_members constraint: %', SQLERRM;
END $$;

-- 4. team_invites table - invited_by reference
DO $$ 
BEGIN
  ALTER TABLE team_invites DROP CONSTRAINT IF EXISTS team_invites_invited_by_fkey;
  
  ALTER TABLE team_invites 
    ADD CONSTRAINT team_invites_invited_by_fkey 
    FOREIGN KEY (invited_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;
    
  RAISE NOTICE 'team_invites_invited_by_fkey updated with SET NULL on delete';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating team_invites invited_by constraint: %', SQLERRM;
END $$;

-- 5. projects table - created_by, owner references if they exist
DO $$ 
BEGIN
  -- Handle created_by if column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'created_by') THEN
    ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
    ALTER TABLE projects 
      ADD CONSTRAINT projects_created_by_fkey 
      FOREIGN KEY (created_by) 
      REFERENCES auth.users(id) 
      ON DELETE SET NULL;
    RAISE NOTICE 'projects_created_by_fkey updated';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating projects created_by constraint: %', SQLERRM;
END $$;

-- 6. issues table - created_by, assignee_id references
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issues' AND column_name = 'created_by') THEN
    ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_created_by_fkey;
    ALTER TABLE issues 
      ADD CONSTRAINT issues_created_by_fkey 
      FOREIGN KEY (created_by) 
      REFERENCES auth.users(id) 
      ON DELETE SET NULL;
    RAISE NOTICE 'issues_created_by_fkey updated';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'issues' AND column_name = 'assignee_id') THEN
    ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_assignee_id_fkey;
    ALTER TABLE issues 
      ADD CONSTRAINT issues_assignee_id_fkey 
      FOREIGN KEY (assignee_id) 
      REFERENCES auth.users(id) 
      ON DELETE SET NULL;
    RAISE NOTICE 'issues_assignee_id_fkey updated';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating issues constraints: %', SQLERRM;
END $$;

-- 7. prds table - created_by reference
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prds' AND column_name = 'created_by') THEN
    ALTER TABLE prds DROP CONSTRAINT IF EXISTS prds_created_by_fkey;
    ALTER TABLE prds 
      ADD CONSTRAINT prds_created_by_fkey 
      FOREIGN KEY (created_by) 
      REFERENCES auth.users(id) 
      ON DELETE SET NULL;
    RAISE NOTICE 'prds_created_by_fkey updated';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating prds created_by constraint: %', SQLERRM;
END $$;

-- 8. notifications table - user_id, from_user_id
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
    ALTER TABLE notifications 
      ADD CONSTRAINT notifications_user_id_fkey 
      FOREIGN KEY (user_id) 
      REFERENCES auth.users(id) 
      ON DELETE CASCADE;
      
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'from_user_id') THEN
      ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_from_user_id_fkey;
      ALTER TABLE notifications 
        ADD CONSTRAINT notifications_from_user_id_fkey 
        FOREIGN KEY (from_user_id) 
        REFERENCES auth.users(id) 
        ON DELETE SET NULL;
    END IF;
    RAISE NOTICE 'notifications constraints updated';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating notifications constraints: %', SQLERRM;
END $$;

-- 9. activity_logs table - user_id
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_logs' AND column_name = 'user_id') THEN
      ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
      ALTER TABLE activity_logs 
        ADD CONSTRAINT activity_logs_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) 
        ON DELETE SET NULL;
      RAISE NOTICE 'activity_logs_user_id_fkey updated';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating activity_logs constraints: %', SQLERRM;
END $$;

-- 10. conversations table - owner_id
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'owner_id') THEN
      ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_owner_id_fkey;
      ALTER TABLE conversations 
        ADD CONSTRAINT conversations_owner_id_fkey 
        FOREIGN KEY (owner_id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE;
      RAISE NOTICE 'conversations_owner_id_fkey updated';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating conversations constraints: %', SQLERRM;
END $$;

-- 11. Check and fix any remaining FK constraints pointing to auth.users
-- This is a catchall to identify any tables we might have missed
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT 
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
      AND rc.delete_rule = 'NO ACTION'
  LOOP
    RAISE NOTICE 'Found FK without CASCADE: %.% -> auth.users (constraint: %)', 
      r.table_name, r.column_name, r.constraint_name;
  END LOOP;
END $$;

-- ============================================================================
-- REMEMBER FOR FUTURE DEVELOPMENT:
-- When creating new tables with user references, ALWAYS include CASCADE:
--
-- Example:
--   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
-- or
--   user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
--
-- Use CASCADE when the child record should be deleted with the user.
-- Use SET NULL when the record should remain but lose its user reference.
-- ============================================================================
