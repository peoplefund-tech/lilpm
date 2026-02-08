-- Fix RLS Policy Recursion for projects and project_members
-- Issue: Infinite recursion detected in policy for relation 'projects' (error 42P17)
-- Cause: projects policy checks project_members, which checks projects
-- Solution: Use SECURITY DEFINER functions or direct table access

-- 1. Drop the problematic policies
DROP POLICY IF EXISTS "Team members can view project members" ON project_members;
DROP POLICY IF EXISTS "Users can view projects they are assigned to" ON projects;
DROP POLICY IF EXISTS "Users can view issues in assigned projects" ON issues;

-- 2. Create helper function to check project membership without triggering RLS
CREATE OR REPLACE FUNCTION is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = _project_id
    AND user_id = _user_id
  );
$$;

-- 3. Create helper function to check team admin/owner status
CREATE OR REPLACE FUNCTION is_team_admin_for_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE p.id = _project_id
    AND tm.user_id = _user_id
    AND tm.role IN ('owner', 'admin')
  );
$$;

-- 4. Recreate projects SELECT policy using the helper function
CREATE POLICY "Users can view projects they are assigned to"
  ON projects FOR SELECT
  USING (
    is_project_member(id, auth.uid())
    OR is_team_admin_for_project(id, auth.uid())
  );

-- 5. Recreate project_members SELECT policy without referencing projects
-- Team members can view project members if they are in the same team
CREATE POLICY "Team members can view project members"
  ON project_members FOR SELECT
  USING (
    -- User is also a project member
    EXISTS (
      SELECT 1 FROM project_members pm2
      WHERE pm2.project_id = project_members.project_id
      AND pm2.user_id = auth.uid()
    )
    OR
    -- Or user is team admin (bypass via function)
    is_team_admin_for_project(project_members.project_id, auth.uid())
  );

-- 6. Recreate issues SELECT policy
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
    -- Issue has project - use helper function to avoid recursion
    (project_id IS NOT NULL AND (
      is_project_member(project_id, auth.uid())
      OR is_team_admin_for_project(project_id, auth.uid())
    ))
  );
