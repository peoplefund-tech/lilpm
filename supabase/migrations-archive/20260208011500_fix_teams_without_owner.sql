-- Fix existing teams that may be missing owner in team_members table
-- This migration ensures all team creators are properly listed as owners

-- First, add owners to teams where the creator exists in auth.users
-- but is not yet in team_members for that team

-- For each team, find users who should be owner (created the team) but aren't in team_members
-- We'll use the teams.created_at to match with user sessions around that time
-- However, we don't have direct creator_id field, so we'll need manual intervention
-- or add a helper function that admins can call

-- Create a function that allows adding missing owners
CREATE OR REPLACE FUNCTION add_team_owner_if_missing(
  _team_id uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert owner if not exists
  INSERT INTO team_members (team_id, user_id, role, joined_at)
  VALUES (_team_id, _user_id, 'owner', NOW())
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'owner';
END;
$$;

-- Grant execute to authenticated users (admins will need to call this)
GRANT EXECUTE ON FUNCTION add_team_owner_if_missing(uuid, uuid) TO authenticated;

-- Create a view to find teams without owners
CREATE OR REPLACE VIEW teams_without_owner AS
SELECT t.id, t.name, t.slug
FROM teams t
WHERE NOT EXISTS (
  SELECT 1 FROM team_members tm
  WHERE tm.team_id = t.id AND tm.role = 'owner'
);

-- Also create a function to automatically add current user as owner if no owner exists
-- This can be called by the app when viewing team members
CREATE OR REPLACE FUNCTION ensure_current_user_is_owner_if_no_owner(
  _team_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  has_owner boolean;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if team has any owner
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = _team_id AND role = 'owner'
  ) INTO has_owner;

  -- If no owner, make current user the owner (only if they are already a member)
  IF NOT has_owner THEN
    -- First check if user is a member of the team
    IF EXISTS (SELECT 1 FROM team_members WHERE team_id = _team_id AND user_id = current_user_id) THEN
      UPDATE team_members
      SET role = 'owner'
      WHERE team_id = _team_id AND user_id = current_user_id;
      RETURN true;
    ELSE
      -- User is not a member, add them as owner
      INSERT INTO team_members (team_id, user_id, role, joined_at)
      VALUES (_team_id, current_user_id, 'owner', NOW());
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_current_user_is_owner_if_no_owner(uuid) TO authenticated;
