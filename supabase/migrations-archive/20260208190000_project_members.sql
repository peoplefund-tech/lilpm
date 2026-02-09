-- Project Members Migration
-- Creates project_members table for per-project access control
-- Users not assigned to a project cannot see the project or related content

-- 1. Create project_members table
CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer')),
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- 3. Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for project_members table
-- Team members can view project members in their team's projects
CREATE POLICY "Team members can view project members"
  ON project_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE p.id = project_members.project_id
    AND tm.user_id = auth.uid()
  ));

-- Team admins and owners can manage project members
CREATE POLICY "Admins can insert project members"
  ON project_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE p.id = project_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  ));

CREATE POLICY "Admins can delete project members"
  ON project_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE p.id = project_members.project_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  ));

-- 5. Update projects RLS to only allow assigned members to see projects
-- First drop existing select policy if it exists
DROP POLICY IF EXISTS "Users can view projects in their teams" ON projects;

-- Create new policy that checks project membership
CREATE POLICY "Users can view projects they are assigned to"
  ON projects FOR SELECT
  USING (
    -- User is a project member
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = projects.id
      AND pm.user_id = auth.uid()
    )
    OR
    -- Or user is team admin/owner (can see all projects)
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = projects.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- 6. Update issues RLS to respect project membership
DROP POLICY IF EXISTS "Users can view issues in their teams" ON issues;

CREATE POLICY "Users can view issues in assigned projects"
  ON issues FOR SELECT
  USING (
    -- Issue has no project (team-level issue) - team member can view
    (project_id IS NULL AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = issues.team_id
      AND tm.user_id = auth.uid()
    ))
    OR
    -- Issue has project - must be project member or admin
    (project_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = issues.project_id
        AND pm.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = issues.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
      )
    ))
  );

-- 7. Migrate existing data: Auto-assign all team members to existing projects
INSERT INTO project_members (project_id, user_id, role, assigned_by, assigned_at)
SELECT 
  p.id as project_id,
  tm.user_id as user_id,
  CASE WHEN p.lead_id = tm.user_id THEN 'lead' ELSE 'member' END as role,
  p.lead_id as assigned_by,
  NOW() as assigned_at
FROM projects p
CROSS JOIN team_members tm
WHERE tm.team_id = p.team_id
ON CONFLICT (project_id, user_id) DO NOTHING;

-- 8. Create function to auto-add new team members to all projects (optional - can be disabled)
CREATE OR REPLACE FUNCTION auto_assign_new_team_member_to_projects()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new team member joins, add them to all existing projects in that team
  INSERT INTO project_members (project_id, user_id, role)
  SELECT p.id, NEW.user_id, 'member'
  FROM projects p
  WHERE p.team_id = NEW.team_id
  ON CONFLICT (project_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create trigger for auto-assignment
DROP TRIGGER IF EXISTS trigger_auto_assign_projects ON team_members;
CREATE TRIGGER trigger_auto_assign_projects
  AFTER INSERT ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_new_team_member_to_projects();

-- 10. Create RPC function for admins to assign/unassign project members
CREATE OR REPLACE FUNCTION assign_project_member(
  _project_id uuid,
  _user_id uuid,
  _role text DEFAULT 'member'
)
RETURNS uuid AS $$
DECLARE
  member_id uuid;
BEGIN
  -- Check if current user is admin/owner of the team
  IF NOT EXISTS (
    SELECT 1 FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE p.id = _project_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can assign project members';
  END IF;
  
  -- Insert or update project member
  INSERT INTO project_members (project_id, user_id, role, assigned_by)
  VALUES (_project_id, _user_id, _role, auth.uid())
  ON CONFLICT (project_id, user_id) 
  DO UPDATE SET role = _role, assigned_by = auth.uid(), assigned_at = NOW()
  RETURNING id INTO member_id;
  
  RETURN member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unassign_project_member(
  _project_id uuid,
  _user_id uuid
)
RETURNS boolean AS $$
BEGIN
  -- Check if current user is admin/owner of the team
  IF NOT EXISTS (
    SELECT 1 FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE p.id = _project_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can unassign project members';
  END IF;
  
  DELETE FROM project_members
  WHERE project_id = _project_id AND user_id = _user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
