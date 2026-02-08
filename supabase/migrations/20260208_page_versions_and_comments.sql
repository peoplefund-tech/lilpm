-- Migration: Page Version History Tables
-- Description: Creates tables to store PRD and Issue page versions for history tracking

-- PRD Versions Table
CREATE TABLE IF NOT EXISTS prd_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES prd_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  title TEXT,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  author_name TEXT,
  change_description TEXT,
  word_count INTEGER DEFAULT 0,
  is_auto_save BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Issue Versions Table  
CREATE TABLE IF NOT EXISTS issue_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  title TEXT,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  author_name TEXT,
  change_description TEXT,
  word_count INTEGER DEFAULT 0,
  is_auto_save BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Block Comments Table
CREATE TABLE IF NOT EXISTS block_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id TEXT NOT NULL,
  page_id UUID NOT NULL,
  page_type TEXT NOT NULL CHECK (page_type IN ('prd', 'issue')),
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  author_name TEXT,
  author_avatar TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Block Comment Replies Table
CREATE TABLE IF NOT EXISTS block_comment_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES block_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  author_name TEXT,
  author_avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance (skip if columns don't exist - table might have been created differently)
DO $$ 
BEGIN
  -- Try prd_document_id first (existing schema), then page_id (new schema)
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_prd_versions_prd_document_id ON prd_versions(prd_document_id);
  EXCEPTION WHEN undefined_column THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_prd_versions_page_id ON prd_versions(page_id);
    EXCEPTION WHEN undefined_column THEN
      NULL; -- Neither column exists, skip
    END;
  END;
END $$;
CREATE INDEX IF NOT EXISTS idx_prd_versions_created_at ON prd_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_versions_page_id ON issue_versions(page_id);
CREATE INDEX IF NOT EXISTS idx_issue_versions_created_at ON issue_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_block_comments_block_id ON block_comments(block_id);
CREATE INDEX IF NOT EXISTS idx_block_comments_page_id ON block_comments(page_id);
CREATE INDEX IF NOT EXISTS idx_block_comment_replies_comment_id ON block_comment_replies(comment_id);

-- RLS Policies

-- PRD Versions: Read access for team members
ALTER TABLE prd_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PRD versions viewable by team members" ON prd_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM prd_documents p
      JOIN team_members tm ON p.team_id = tm.team_id
      WHERE p.id = prd_versions.page_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "PRD versions creatable by team members" ON prd_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM prd_documents p
      JOIN team_members tm ON p.team_id = tm.team_id
      WHERE p.id = prd_versions.page_id
      AND tm.user_id = auth.uid()
    )
  );

-- Issue Versions: Read access for team members
ALTER TABLE issue_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Issue versions viewable by team members" ON issue_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM issues i
      JOIN team_members tm ON i.team_id = tm.team_id
      WHERE i.id = issue_versions.page_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Issue versions creatable by team members" ON issue_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM issues i
      JOIN team_members tm ON i.team_id = tm.team_id
      WHERE i.id = issue_versions.page_id
      AND tm.user_id = auth.uid()
    )
  );

-- Block Comments: Full access for team members
ALTER TABLE block_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block comments viewable by team members" ON block_comments
  FOR SELECT USING (
    CASE 
      WHEN page_type = 'prd' THEN EXISTS (
        SELECT 1 FROM prd_documents p
        JOIN team_members tm ON p.team_id = tm.team_id
        WHERE p.id = block_comments.page_id
        AND tm.user_id = auth.uid()
      )
      WHEN page_type = 'issue' THEN EXISTS (
        SELECT 1 FROM issues i
        JOIN team_members tm ON i.team_id = tm.team_id
        WHERE i.id = block_comments.page_id
        AND tm.user_id = auth.uid()
      )
      ELSE false
    END
  );

CREATE POLICY "Block comments creatable by team members" ON block_comments
  FOR INSERT WITH CHECK (
    CASE 
      WHEN page_type = 'prd' THEN EXISTS (
        SELECT 1 FROM prd_documents p
        JOIN team_members tm ON p.team_id = tm.team_id
        WHERE p.id = block_comments.page_id
        AND tm.user_id = auth.uid()
      )
      WHEN page_type = 'issue' THEN EXISTS (
        SELECT 1 FROM issues i
        JOIN team_members tm ON i.team_id = tm.team_id
        WHERE i.id = block_comments.page_id
        AND tm.user_id = auth.uid()
      )
      ELSE false
    END
  );

CREATE POLICY "Block comments updatable by author" ON block_comments
  FOR UPDATE USING (author_id = auth.uid());

-- Block Comment Replies: Full access for team members
ALTER TABLE block_comment_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Replies viewable if parent comment viewable" ON block_comment_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM block_comments c
      WHERE c.id = block_comment_replies.comment_id
    )
  );

CREATE POLICY "Replies creatable by authenticated users" ON block_comment_replies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
