-- ============================================================================
-- Migration: Fix All User Deletion FK Constraints (Comprehensive)
-- ============================================================================
-- This migration DROPS and RECREATES all foreign key constraints pointing to 
-- auth.users to ensure they have proper ON DELETE action.
-- ============================================================================

-- First, let's find and fix ALL constraints that reference auth.users without CASCADE
-- by dynamically generating and executing ALTER TABLE statements

DO $$
DECLARE
  r RECORD;
  new_action TEXT;
BEGIN
  -- Loop through all foreign keys pointing to auth.users
  FOR r IN 
    SELECT 
      tc.constraint_name,
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu 
      ON tc.constraint_name = kcu.constraint_name 
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu 
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints AS rc 
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
      AND tc.table_schema = 'public'
      AND rc.delete_rule != 'CASCADE'
      AND rc.delete_rule != 'SET NULL'
  LOOP
    RAISE NOTICE 'Found FK without proper delete action: %.% on column % (current: %)', 
      r.table_name, r.constraint_name, r.column_name, r.delete_rule;
    
    -- Determine the appropriate action:
    -- - profiles should CASCADE (user identity)
    -- - created_by, assigned_to, etc should SET NULL
    IF r.table_name = 'profiles' OR r.column_name = 'user_id' THEN
      new_action := 'CASCADE';
    ELSE
      new_action := 'SET NULL';
    END IF;
    
    -- Drop the old constraint
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', 
      r.table_schema, r.table_name, r.constraint_name);
    
    -- Recreate with proper delete action
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE %s',
      r.table_schema, r.table_name, r.constraint_name, r.column_name, new_action);
    
    RAISE NOTICE 'Updated constraint %.% with ON DELETE %', r.table_name, r.constraint_name, new_action;
  END LOOP;
END $$;

-- Also ensure profiles cascade is correctly set (critical path)
DO $$
BEGIN
  -- First check if the profiles constraint exists and has the right action
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_name = 'profiles' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND rc.delete_rule != 'CASCADE'
  ) THEN
    -- Drop and recreate the profiles FK
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
    ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'profiles_id_fkey updated to CASCADE';
  ELSE
    RAISE NOTICE 'profiles FK already has CASCADE or does not exist';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating profiles FK: %', SQLERRM;
END $$;

-- Check profiles FK directly and recreate if it doesn't exist
DO $$
BEGIN
  -- Try to create the FK if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'profiles' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Created new profiles_id_fkey with CASCADE';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create profiles FK: %', SQLERRM;
END $$;

-- Summary log
DO $$
DECLARE
  count_without_delete INT;
BEGIN
  SELECT COUNT(*) INTO count_without_delete
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
  JOIN information_schema.referential_constraints AS rc ON rc.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_schema = 'auth'
    AND ccu.table_name = 'users'
    AND tc.table_schema = 'public'
    AND rc.delete_rule != 'CASCADE'
    AND rc.delete_rule != 'SET NULL';
  
  IF count_without_delete > 0 THEN
    RAISE WARNING 'Still found % FK constraints without proper delete action!', count_without_delete;
  ELSE
    RAISE NOTICE 'All FK constraints to auth.users now have proper delete actions.';
  END IF;
END $$;
