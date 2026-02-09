-- Fix the get_invite_preview RPC function to accept TEXT parameter 
-- (original migration used UUID which causes type mismatch with JSON input)

-- Drop existing function(s)
DROP FUNCTION IF EXISTS public.get_invite_preview(UUID);
DROP FUNCTION IF EXISTS public.get_invite_preview(TEXT);

CREATE OR REPLACE FUNCTION public.get_invite_preview(invite_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  invite_record RECORD;
  token_uuid UUID;
BEGIN
  -- Cast text to UUID
  BEGIN
    token_uuid := invite_token::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', 'not_found'
    );
  END;
  
  -- Query invite with team and inviter info
  SELECT 
    ti.id,
    ti.status,
    ti.expires_at,
    ti.email,
    ti.role,
    t.name as team_name,
    p.name as inviter_name,
    p.avatar_url as inviter_avatar
  INTO invite_record
  FROM team_invites ti
  LEFT JOIN teams t ON ti.team_id = t.id
  LEFT JOIN profiles p ON ti.invited_by = p.id
  WHERE ti.token = invite_token;  -- Compare TEXT with TEXT (not UUID)
  
  -- Check if invite exists
  IF invite_record IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', 'not_found'
    );
  END IF;
  
  -- Check if expired
  IF invite_record.expires_at IS NOT NULL AND invite_record.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', 'expired',
      'teamName', invite_record.team_name,
      'inviterName', invite_record.inviter_name,
      'inviterAvatar', invite_record.inviter_avatar,
      'email', invite_record.email,
      'role', invite_record.role
    );
  END IF;
  
  -- Check status
  IF invite_record.status != 'pending' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', invite_record.status,
      'teamName', invite_record.team_name,
      'inviterName', invite_record.inviter_name,
      'inviterAvatar', invite_record.inviter_avatar,
      'email', invite_record.email,
      'role', invite_record.role
    );
  END IF;
  
  -- Return valid invite preview
  RETURN jsonb_build_object(
    'valid', true,
    'status', 'pending',
    'teamName', invite_record.team_name,
    'inviterName', invite_record.inviter_name,
    'inviterAvatar', invite_record.inviter_avatar,
    'email', invite_record.email,
    'role', invite_record.role
  );
END;
$$;

-- Grant execute permission to anonymous users (for invite preview)
GRANT EXECUTE ON FUNCTION public.get_invite_preview(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_invite_preview(TEXT) IS 
  'Retrieves team invite preview information by token (accepts TEXT, casts to UUID internally). Uses SECURITY DEFINER to bypass RLS for public access.';
