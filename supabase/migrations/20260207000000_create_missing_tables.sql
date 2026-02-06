-- Create user_ai_settings table for AI provider preferences
CREATE TABLE IF NOT EXISTS user_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'auto',
  api_keys JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_ai_settings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own settings
CREATE POLICY "Users can view own ai_settings"
  ON user_ai_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai_settings"
  ON user_ai_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai_settings"
  ON user_ai_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Create prd_yjs_state table for CRDT collaboration
CREATE TABLE IF NOT EXISTS prd_yjs_state (
  prd_id UUID PRIMARY KEY REFERENCES prd_documents(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE prd_yjs_state ENABLE ROW LEVEL SECURITY;

-- Team members can access their team's PRD Yjs state
CREATE POLICY "Team members can read prd_yjs_state"
  ON prd_yjs_state FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM prd_documents p
    JOIN team_members tm ON p.team_id = tm.team_id
    WHERE p.id = prd_yjs_state.prd_id AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Team members can insert prd_yjs_state"
  ON prd_yjs_state FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM prd_documents p
    JOIN team_members tm ON p.team_id = tm.team_id
    WHERE p.id = prd_yjs_state.prd_id AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Team members can update prd_yjs_state"
  ON prd_yjs_state FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM prd_documents p
    JOIN team_members tm ON p.team_id = tm.team_id
    WHERE p.id = prd_yjs_state.prd_id AND tm.user_id = auth.uid()
  ));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_ai_settings_updated_at ON user_ai_settings;
CREATE TRIGGER update_user_ai_settings_updated_at
  BEFORE UPDATE ON user_ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prd_yjs_state_updated_at ON prd_yjs_state;
CREATE TRIGGER update_prd_yjs_state_updated_at
  BEFORE UPDATE ON prd_yjs_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
