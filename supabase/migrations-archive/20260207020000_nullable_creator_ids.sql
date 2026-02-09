-- Migration: Make creator_id/created_by nullable for easier user deletion
-- This allows users to be deleted without orphaning their created issues/PRDs

-- 1. Make issues.creator_id nullable
ALTER TABLE issues ALTER COLUMN creator_id DROP NOT NULL;

-- 2. Make prd_documents.created_by nullable  
ALTER TABLE prd_documents ALTER COLUMN created_by DROP NOT NULL;

-- 3. Update the delete-users Edge Function can now use SET NULL instead of reassigning
COMMENT ON COLUMN issues.creator_id IS 'Nullable: allows preserving issues after creator deletion';
COMMENT ON COLUMN prd_documents.created_by IS 'Nullable: allows preserving PRDs after creator deletion';
