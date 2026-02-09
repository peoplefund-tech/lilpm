-- Issue Templates: Pre-defined templates for common issue types
-- Allows teams to quickly create issues with standard fields

-- Create issue_templates table
CREATE TABLE IF NOT EXISTS issue_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  
  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📝',
  
  -- Default values to apply when using template
  default_title TEXT,
  default_description TEXT,
  default_status TEXT DEFAULT 'backlog',
  default_priority TEXT DEFAULT 'none',
  default_labels TEXT[] DEFAULT '{}',
  default_estimate INTEGER,
  
  -- Template settings
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index for efficient team lookup
CREATE INDEX IF NOT EXISTS idx_issue_templates_team_id ON issue_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_issue_templates_active ON issue_templates(team_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE issue_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Team members can manage templates
CREATE POLICY "Team members can view templates"
  ON issue_templates FOR SELECT
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team members can create templates"
  ON issue_templates FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team members can update templates"
  ON issue_templates FOR UPDATE
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team members can delete templates"
  ON issue_templates FOR DELETE
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- Seed some default templates (optional, teams can customize)
-- These will be available for all teams
COMMENT ON TABLE issue_templates IS 'Pre-defined templates for quick issue creation';
