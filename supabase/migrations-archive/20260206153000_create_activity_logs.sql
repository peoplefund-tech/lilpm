-- Activity Logs Table for tracking all user actions
-- Tracks invites, cancellations, permission changes, etc.

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who performed the action
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Context
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Action details
  action_type TEXT NOT NULL,  -- 'invite_sent', 'invite_cancelled', 'invite_accepted', 'member_added', 'member_removed', 'role_changed'
  target_type TEXT NOT NULL,  -- 'team_member', 'team_invite', 'project_member'
  target_id UUID,             -- ID of affected record (member_id, invite_id, etc.)
  target_email TEXT,          -- For invites where user may not exist yet
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- User being affected
  
  -- Change tracking
  old_value JSONB,            -- Previous state (e.g., {"role": "member"})
  new_value JSONB,            -- New state (e.g., {"role": "admin"})
  
  -- Additional context
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_team_id ON activity_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target_user_id ON activity_logs(target_user_id);

-- RLS Policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Team members can view activity logs for their teams
CREATE POLICY "Team members can view activity logs"
  ON activity_logs FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Only authenticated users can insert (via service)
CREATE POLICY "Authenticated users can insert activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Comments for documentation
COMMENT ON TABLE activity_logs IS 'Tracks all user actions related to team/project membership and permissions';
COMMENT ON COLUMN activity_logs.action_type IS 'Type of action: invite_sent, invite_cancelled, invite_accepted, invite_rejected, member_added, member_removed, role_changed';
COMMENT ON COLUMN activity_logs.target_type IS 'Type of target: team_member, team_invite, project_member';
