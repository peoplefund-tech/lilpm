-- Fix RLS policies for team_members to allow invite acceptance
-- Users with a valid pending invite should be able to join the team

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert themselves via valid invite" ON team_members;

-- Allow users to be added as team members if they have a valid pending invite
CREATE POLICY "Users can insert themselves via valid invite"
  ON team_members
  FOR INSERT
  WITH CHECK (
    -- The user_id being inserted must match the current auth user
    user_id = auth.uid()
    AND
    -- Must have a valid pending invite for this team with matching email
    EXISTS (
      SELECT 1 FROM team_invites
      INNER JOIN profiles ON profiles.email = team_invites.email
      WHERE team_invites.team_id = team_members.team_id
      AND team_invites.status = 'pending'
      AND profiles.id = auth.uid()
      AND (team_invites.expires_at IS NULL OR team_invites.expires_at > NOW())
    )
  );

-- Also ensure team owners/admins can add members directly
DROP POLICY IF EXISTS "Team admins can add members" ON team_members;
CREATE POLICY "Team admins can add members"
  ON team_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members existing
      WHERE existing.team_id = team_members.team_id
      AND existing.user_id = auth.uid()
      AND existing.role IN ('owner', 'admin')
    )
  );

-- Allow users to view team members if they are a member
DROP POLICY IF EXISTS "Team members can view team members" ON team_members;
CREATE POLICY "Team members can view team members"
  ON team_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members existing
      WHERE existing.team_id = team_members.team_id
      AND existing.user_id = auth.uid()
    )
  );

-- Allow admins/owners to update/delete members
DROP POLICY IF EXISTS "Team admins can update members" ON team_members;
CREATE POLICY "Team admins can update members"
  ON team_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members existing
      WHERE existing.team_id = team_members.team_id
      AND existing.user_id = auth.uid()
      AND existing.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Team admins can delete members" ON team_members;
CREATE POLICY "Team admins can delete members"
  ON team_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members existing
      WHERE existing.team_id = team_members.team_id
      AND existing.user_id = auth.uid()
      AND existing.role IN ('owner', 'admin')
    )
  );
