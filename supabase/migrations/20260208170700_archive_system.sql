-- Add archived_at column to issues and prd_documents tables for 30-day archive retention
-- Archived items will be hidden from normal views and permanently deleted after 30 days

-- Add archived_at to issues table
ALTER TABLE issues ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Add archived_at to prd_documents table  
ALTER TABLE prd_documents ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient filtering of non-archived items
CREATE INDEX IF NOT EXISTS idx_issues_archived_at ON issues(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prd_documents_archived_at ON prd_documents(archived_at) WHERE archived_at IS NULL;

-- Create index for finding items to permanently delete (archived > 30 days)
CREATE INDEX IF NOT EXISTS idx_issues_archived_cleanup ON issues(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prd_documents_archived_cleanup ON prd_documents(archived_at) WHERE archived_at IS NOT NULL;

-- RPC function to get archived items
CREATE OR REPLACE FUNCTION get_archived_items(p_team_id UUID)
RETURNS TABLE (
  item_type TEXT,
  id UUID,
  title TEXT,
  archived_at TIMESTAMPTZ,
  days_until_deletion INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'issue'::TEXT as item_type,
    i.id,
    i.title,
    i.archived_at,
    30 - EXTRACT(DAY FROM (NOW() - i.archived_at))::INTEGER as days_until_deletion
  FROM issues i
  WHERE i.team_id = p_team_id 
    AND i.archived_at IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'prd'::TEXT as item_type,
    p.id,
    p.title,
    p.archived_at,
    30 - EXTRACT(DAY FROM (NOW() - p.archived_at))::INTEGER as days_until_deletion
  FROM prd_documents p
  WHERE p.team_id = p_team_id 
    AND p.archived_at IS NOT NULL
  
  ORDER BY archived_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to archive item
CREATE OR REPLACE FUNCTION archive_item(p_item_type TEXT, p_item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_item_type = 'issue' THEN
    UPDATE issues SET archived_at = NOW() WHERE id = p_item_id;
  ELSIF p_item_type = 'prd' THEN
    UPDATE prd_documents SET archived_at = NOW() WHERE id = p_item_id;
  ELSE
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to restore item from archive
CREATE OR REPLACE FUNCTION restore_item(p_item_type TEXT, p_item_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_item_type = 'issue' THEN
    UPDATE issues SET archived_at = NULL WHERE id = p_item_id;
  ELSIF p_item_type = 'prd' THEN
    UPDATE prd_documents SET archived_at = NULL WHERE id = p_item_id;
  ELSE
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to permanently delete expired archived items (called by cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_archives()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete issues archived more than 30 days ago
  DELETE FROM issues WHERE archived_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete PRDs archived more than 30 days ago
  DELETE FROM prd_documents WHERE archived_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_archived_items(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_item(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_item(TEXT, UUID) TO authenticated;
-- cleanup_expired_archives should only be called by service role (cron)
