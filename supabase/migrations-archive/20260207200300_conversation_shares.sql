-- Migration: Create conversation_shares table for sharing lily conversations
-- Created at: 2026-02-07T20:03:00

-- Create conversation_shares table
CREATE TABLE IF NOT EXISTS conversation_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  access_type TEXT NOT NULL DEFAULT 'view' CHECK (access_type IN ('view', 'edit')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create conversation_access_requests table for access request workflow
CREATE TABLE IF NOT EXISTS conversation_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  share_id UUID NOT NULL REFERENCES conversation_shares(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_shares_conversation ON conversation_shares(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_shares_token ON conversation_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_conversation_access_requests_conversation ON conversation_access_requests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_access_requests_status ON conversation_access_requests(status);

-- Enable RLS
ALTER TABLE conversation_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_access_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversation_shares
CREATE POLICY "Users can view shares for their conversations"
  ON conversation_shares FOR SELECT
  TO authenticated
  USING (
    shared_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM conversations lc
      WHERE lc.id = conversation_id AND lc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create shares for their conversations"
  ON conversation_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations lc
      WHERE lc.id = conversation_id AND lc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own shares"
  ON conversation_shares FOR UPDATE
  TO authenticated
  USING (shared_by = auth.uid());

CREATE POLICY "Users can delete their own shares"
  ON conversation_shares FOR DELETE
  TO authenticated
  USING (shared_by = auth.uid());

-- RLS Policies for conversation_access_requests
CREATE POLICY "Users can view requests for their shares"
  ON conversation_access_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM conversation_shares cs
      JOIN conversations lc ON cs.conversation_id = lc.id
      WHERE cs.id = share_id AND lc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create access requests"
  ON conversation_access_requests FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Owners can update access requests"
  ON conversation_access_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_shares cs
      JOIN conversations lc ON cs.conversation_id = lc.id
      WHERE cs.id = share_id AND lc.user_id = auth.uid()
    )
  );

-- Function to get shared conversation by token
CREATE OR REPLACE FUNCTION get_shared_conversation(p_token TEXT)
RETURNS TABLE (
  conversation_id UUID,
  title TEXT,
  access_type TEXT,
  is_public BOOLEAN,
  shared_by_name TEXT,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.conversation_id,
    lc.title,
    cs.access_type,
    cs.is_public,
    p.name as shared_by_name,
    cs.expires_at
  FROM conversation_shares cs
  JOIN conversations lc ON cs.conversation_id = lc.id
  LEFT JOIN profiles p ON cs.shared_by = p.id
  WHERE cs.share_token = p_token
    AND (cs.expires_at IS NULL OR cs.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
