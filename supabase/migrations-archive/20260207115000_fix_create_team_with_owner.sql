-- Fix create_team_with_owner RPC function to properly add team creator as owner
-- This ensures the team creator always appears in team_members as owner

-- Drop existing function if exists
DROP FUNCTION IF EXISTS create_team_with_owner(text, text, text);

-- Create or replace the function
CREATE OR REPLACE FUNCTION create_team_with_owner(
  _name text,
  _slug text,
  _issue_prefix text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_team_id uuid;
  new_team json;
  current_user_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the team
  INSERT INTO teams (name, slug, issue_prefix, created_at, updated_at)
  VALUES (
    _name,
    _slug,
    COALESCE(_issue_prefix, UPPER(LEFT(_slug, 3))),
    NOW(),
    NOW()
  )
  RETURNING id INTO new_team_id;

  -- Add creator as owner in team_members
  INSERT INTO team_members (team_id, user_id, role, joined_at)
  VALUES (new_team_id, current_user_id, 'owner', NOW())
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'owner';

  -- Return the created team as JSON
  SELECT json_build_object(
    'id', t.id,
    'name', t.name,
    'slug', t.slug,
    'issue_prefix', t.issue_prefix,
    'created_at', t.created_at,
    'updated_at', t.updated_at
  ) INTO new_team
  FROM teams t
  WHERE t.id = new_team_id;

  RETURN new_team;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_team_with_owner(text, text, text) TO authenticated;

-- Also fix any existing teams where the creator is not in team_members
-- by adding a helper function to add owner if missing
CREATE OR REPLACE FUNCTION ensure_team_has_owner()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For teams with no owner, this would need to be run manually with specific user IDs
  -- This is just a placeholder for the fix
  NULL;
END;
$$;
