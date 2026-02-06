-- Create table for storing Yjs CRDT state for PRD documents
-- This enables real-time collaborative editing with persistence

CREATE TABLE IF NOT EXISTS prd_yjs_state (
  prd_id UUID PRIMARY KEY REFERENCES prd_documents(id) ON DELETE CASCADE,
  state TEXT NOT NULL, -- Base64 encoded Yjs state
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_prd_yjs_state_updated_at ON prd_yjs_state(updated_at);

-- Enable RLS
ALTER TABLE prd_yjs_state ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Team members can read/write their team's PRD Yjs state
CREATE POLICY "Team members can read prd_yjs_state"
  ON prd_yjs_state
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM prd_documents p
      JOIN team_members tm ON p.team_id = tm.team_id
      WHERE p.id = prd_yjs_state.prd_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert prd_yjs_state"
  ON prd_yjs_state
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM prd_documents p
      JOIN team_members tm ON p.team_id = tm.team_id
      WHERE p.id = prd_yjs_state.prd_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can update prd_yjs_state"
  ON prd_yjs_state
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM prd_documents p
      JOIN team_members tm ON p.team_id = tm.team_id
      WHERE p.id = prd_yjs_state.prd_id
      AND tm.user_id = auth.uid()
    )
  );

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_prd_yjs_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_update_prd_yjs_state_updated_at ON prd_yjs_state;
CREATE TRIGGER trigger_update_prd_yjs_state_updated_at
  BEFORE UPDATE ON prd_yjs_state
  FOR EACH ROW
  EXECUTE FUNCTION update_prd_yjs_state_updated_at();
