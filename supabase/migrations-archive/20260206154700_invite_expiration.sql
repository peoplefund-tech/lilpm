-- Set expires_at to 24 hours from creation for team invites
-- Also update existing pending invites

-- Update existing pending invites to expire 24 hours from their creation
UPDATE team_invites
SET expires_at = created_at + INTERVAL '24 hours'
WHERE status = 'pending' 
  AND (expires_at IS NULL OR expires_at > NOW() + INTERVAL '24 hours');

-- Create a trigger to automatically set expires_at on insert
CREATE OR REPLACE FUNCTION set_invite_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If expires_at is not set, default to 24 hours from now
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS set_invite_expires_at_trigger ON team_invites;

-- Create the trigger
CREATE TRIGGER set_invite_expires_at_trigger
  BEFORE INSERT ON team_invites
  FOR EACH ROW
  EXECUTE FUNCTION set_invite_expires_at();

-- Add index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_team_invites_expires_at ON team_invites(expires_at);
