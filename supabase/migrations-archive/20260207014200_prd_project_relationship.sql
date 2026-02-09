-- ============================================================================
-- Migration: PRD-Project Many-to-Many Relationship
-- ============================================================================
-- Enables PRDs to be linked to multiple projects and vice versa.
-- ============================================================================

-- Create the join table
CREATE TABLE IF NOT EXISTS prd_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id UUID NOT NULL REFERENCES prd_documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(prd_id, project_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_prd_projects_prd_id ON prd_projects(prd_id);
CREATE INDEX IF NOT EXISTS idx_prd_projects_project_id ON prd_projects(project_id);

-- Enable RLS
ALTER TABLE prd_projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can manage prd_projects for their team's PRDs and projects
CREATE POLICY "Users can view prd_projects for their team" ON prd_projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM prd_documents p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE p.id = prd_projects.prd_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create prd_projects for their team" ON prd_projects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM prd_documents p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE p.id = prd_projects.prd_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete prd_projects for their team" ON prd_projects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM prd_documents p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE p.id = prd_projects.prd_id AND tm.user_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON TABLE prd_projects IS 'Join table for many-to-many relationship between PRDs and Projects';
