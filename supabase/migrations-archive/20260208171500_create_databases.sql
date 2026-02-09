-- Create databases table for Notion-style database feature
-- Migration: 20260208_create_databases.sql

-- Databases table (similar to Notion databases)
CREATE TABLE IF NOT EXISTS public.databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📊',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Database properties (columns/fields)
CREATE TABLE IF NOT EXISTS public.database_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES public.databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'text', 'number', 'select', 'multi_select', 'date', 'person',
    'checkbox', 'url', 'email', 'phone', 'formula', 'relation',
    'rollup', 'created_time', 'created_by', 'last_edited_time',
    'last_edited_by', 'files', 'status'
  )),
  options JSONB DEFAULT '[]', -- For select/multi_select options
  formula TEXT, -- For formula type
  relation_database_id UUID REFERENCES public.databases(id) ON DELETE SET NULL,
  rollup_property TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Database rows (records)
CREATE TABLE IF NOT EXISTS public.database_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES public.databases(id) ON DELETE CASCADE,
  properties JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Database views (table, board, calendar, list, gallery, timeline)
CREATE TABLE IF NOT EXISTS public.database_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES public.databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('table', 'board', 'calendar', 'list', 'gallery', 'timeline')),
  filters JSONB DEFAULT '[]',
  sorts JSONB DEFAULT '[]',
  group_by TEXT,
  visible_properties JSONB DEFAULT '[]',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_databases_team_id ON public.databases(team_id);
CREATE INDEX IF NOT EXISTS idx_database_properties_database_id ON public.database_properties(database_id);
CREATE INDEX IF NOT EXISTS idx_database_rows_database_id ON public.database_rows(database_id);
CREATE INDEX IF NOT EXISTS idx_database_views_database_id ON public.database_views(database_id);

-- RLS Policies
ALTER TABLE public.databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_views ENABLE ROW LEVEL SECURITY;

-- Team members can view/edit databases
CREATE POLICY "Team members can view databases" ON public.databases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = databases.team_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can create databases" ON public.databases
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = databases.team_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can update databases" ON public.databases
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = databases.team_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can delete databases" ON public.databases
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = databases.team_id AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- Properties policies (inherit from database)
CREATE POLICY "Team members can manage properties" ON public.database_properties
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.databases d
      JOIN public.team_members tm ON tm.team_id = d.team_id
      WHERE d.id = database_properties.database_id AND tm.user_id = auth.uid()
    )
  );

-- Rows policies (inherit from database)
CREATE POLICY "Team members can manage rows" ON public.database_rows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.databases d
      JOIN public.team_members tm ON tm.team_id = d.team_id
      WHERE d.id = database_rows.database_id AND tm.user_id = auth.uid()
    )
  );

-- Views policies (inherit from database)
CREATE POLICY "Team members can manage views" ON public.database_views
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.databases d
      JOIN public.team_members tm ON tm.team_id = d.team_id
      WHERE d.id = database_views.database_id AND tm.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_database_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_databases_updated_at
  BEFORE UPDATE ON public.databases
  FOR EACH ROW EXECUTE FUNCTION update_database_updated_at();

CREATE TRIGGER trigger_database_rows_updated_at
  BEFORE UPDATE ON public.database_rows
  FOR EACH ROW EXECUTE FUNCTION update_database_updated_at();
