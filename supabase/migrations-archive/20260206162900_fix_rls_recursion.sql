-- Fix infinite recursion in team_members RLS policies
-- The issue is that policies can't reference the same table in a subquery

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can insert themselves via valid invite" ON team_members;
DROP POLICY IF EXISTS "Team admins can add members" ON team_members;
DROP POLICY IF EXISTS "Team members can view team members" ON team_members;
DROP POLICY IF EXISTS "Team admins can update members" ON team_members;
DROP POLICY IF EXISTS "Team admins can delete members" ON team_members;

-- Create a SECURITY DEFINER function to check team membership (bypasses RLS)
CREATE OR REPLACE FUNCTION is_team_member_safe(check_team_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = check_team_id
    AND user_id = check_user_id
  );
END;
$$;

-- Create a function to check if user has admin role in team
CREATE OR REPLACE FUNCTION is_team_admin_safe(check_team_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = check_team_id
    AND user_id = check_user_id
    AND role IN ('owner', 'admin')
  );
END;
$$;

-- Now create policies using these functions

-- SELECT: Users can view team members if they are a member
CREATE POLICY "Team members can view members"
  ON team_members
  FOR SELECT
  USING (is_team_member_safe(team_id, auth.uid()));

-- INSERT: Allow via valid invite OR by admin
CREATE POLICY "Members can join via invite or admin add"
  ON team_members
  FOR INSERT
  WITH CHECK (
    -- User adding themselves with a valid invite
    (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM team_invites ti
        INNER JOIN profiles p ON p.email = ti.email
        WHERE ti.team_id = team_members.team_id
        AND ti.status = 'pending'
        AND p.id = auth.uid()
        AND (ti.expires_at IS NULL OR ti.expires_at > NOW())
      )
    )
    OR
    -- Admin adding a member
    is_team_admin_safe(team_members.team_id, auth.uid())
  );

-- UPDATE: Only team admins
CREATE POLICY "Team admins can update members"
  ON team_members
  FOR UPDATE
  USING (is_team_admin_safe(team_id, auth.uid()));

-- DELETE: Only team admins
CREATE POLICY "Team admins can delete members"
  ON team_members
  FOR DELETE
  USING (is_team_admin_safe(team_id, auth.uid()));
