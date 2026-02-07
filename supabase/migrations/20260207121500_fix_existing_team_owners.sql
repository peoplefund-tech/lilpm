-- Fix existing team owners: Set the first member (by joined_at) of each team as owner
-- This migrates existing data where team creators were not properly set as owners

-- First, ensure each team has at least one owner
-- Select the earliest member for each team that doesn't have an owner
WITH earliest_members AS (
  SELECT DISTINCT ON (tm.team_id) 
    tm.id as member_id,
    tm.team_id,
    tm.user_id,
    tm.role,
    tm.joined_at
  FROM team_members tm
  WHERE NOT EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = tm.team_id AND role = 'owner'
  )
  ORDER BY tm.team_id, tm.joined_at ASC
)
UPDATE team_members 
SET role = 'owner'
WHERE id IN (SELECT member_id FROM earliest_members);

-- Log the changes
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Updated % team members to owner role', affected_count;
END $$;
