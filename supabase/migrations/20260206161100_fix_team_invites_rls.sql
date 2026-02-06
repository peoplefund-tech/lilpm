-- Fix RLS policies for team_invites to allow token-based lookup
-- The issue is that authenticated users can't read invites by token if they're not team members

-- Drop existing select policy if it exists
DROP POLICY IF EXISTS "Team members can view invites" ON team_invites;
DROP POLICY IF EXISTS "Anyone can view invite by token" ON team_invites;
DROP POLICY IF EXISTS "Authenticated users can view invite by token" ON team_invites;

-- Allow team members to view all invites for their team
CREATE POLICY "Team members can view invites"
  ON team_invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invites.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Allow any authenticated user to view an invite by token (for accepting invites)
-- This is crucial for the accept invite flow where user may not be a team member yet
CREATE POLICY "Authenticated users can view invite by token"
  ON team_invites
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

-- Allow team admins/owners to insert invites
DROP POLICY IF EXISTS "Team admins can create invites" ON team_invites;
CREATE POLICY "Team admins can create invites"
  ON team_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invites.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- Allow team admins/owners to update invites (cancel, etc.)
DROP POLICY IF EXISTS "Team admins can update invites" ON team_invites;
CREATE POLICY "Team admins can update invites"
  ON team_invites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invites.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- Allow the invited user to update their own invite (accept)
DROP POLICY IF EXISTS "Invited user can accept invite" ON team_invites;
CREATE POLICY "Invited user can accept invite"
  ON team_invites
  FOR UPDATE
  USING (
    -- Match by email of the current user
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email = team_invites.email
    )
  );
