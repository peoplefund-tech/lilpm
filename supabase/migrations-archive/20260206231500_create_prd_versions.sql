-- PRD Version History Table
-- Stores snapshots of PRD content for version history and restore functionality

CREATE TABLE IF NOT EXISTS public.prd_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id UUID NOT NULL REFERENCES public.prd_documents(id) ON DELETE CASCADE,
  content TEXT,
  title TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  change_summary TEXT
);

-- Indexes for efficient queries
CREATE INDEX idx_prd_versions_prd_id ON public.prd_versions(prd_id);
CREATE INDEX idx_prd_versions_created_at ON public.prd_versions(created_at DESC);

-- RLS Policies
ALTER TABLE public.prd_versions ENABLE ROW LEVEL SECURITY;

-- Users can view versions of PRDs they have access to (same team)
CREATE POLICY "Team members can view PRD versions"
  ON public.prd_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.prd_documents pd
      JOIN public.team_members tm ON tm.team_id = pd.team_id
      WHERE pd.id = prd_versions.prd_id
      AND tm.user_id = auth.uid()
    )
  );

-- Users can create versions for PRDs in their team
CREATE POLICY "Team members can create PRD versions"
  ON public.prd_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prd_documents pd
      JOIN public.team_members tm ON tm.team_id = pd.team_id
      WHERE pd.id = prd_versions.prd_id
      AND tm.user_id = auth.uid()
    )
  );

-- Only admins can delete versions
CREATE POLICY "Admins can delete PRD versions"
  ON public.prd_versions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.prd_documents pd
      JOIN public.team_members tm ON tm.team_id = pd.team_id
      WHERE pd.id = prd_versions.prd_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('admin', 'owner')
    )
  );
