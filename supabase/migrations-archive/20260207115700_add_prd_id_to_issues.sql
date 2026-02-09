-- Add prd_id column to issues table for Issue-PRD linking
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS prd_id uuid REFERENCES prd_documents(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_issues_prd_id ON issues(prd_id);

-- Add comment for documentation
COMMENT ON COLUMN issues.prd_id IS 'Reference to the linked PRD document';
