import { supabase } from '@/lib/supabase';
import type { Profile, Team, TeamMember, TeamInvite, TeamRole } from '@/types/database';
import { logInviteSent, logInviteCancelled, logInviteAccepted, logRoleChanged, logMemberRemoved } from './activityService';

// ============================================
// PROFILE SERVICES
// ============================================

export const profileService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data as Profile | null;
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates as any)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  },
};

// ============================================
// TEAM SERVICES
// ============================================

export const teamService = {
  async getTeams(): Promise<Team[]> {
    // First get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Query teams through team_members to respect RLS
    const { data, error } = await supabase
      .from('team_members')
      .select('team:teams(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });

    if (error) {
      console.error('Failed to load teams:', error);
      throw error;
    }

    // Extract teams from the joined result
    // Supabase returns team as an object, not an array for single relations
    const teams = (data || [])
      .map(row => row.team as unknown as Team)
      .filter((team): team is Team => team !== null && typeof team === 'object' && 'id' in team);

    return teams;
  },

  async getTeam(teamId: string): Promise<Team | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error) throw error;
    return data as Team | null;
  },

  async createTeam(name: string, slug: string, issuePrefix?: string): Promise<Team> {
    // First check for a valid session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Please verify your email first, then try again.');
      }
    }

    // Use RPC function that handles team creation + owner assignment atomically
    // This bypasses RLS issues since the function uses SECURITY DEFINER
    const { data: team, error } = await supabase
      .rpc('create_team_with_owner', {
        _name: name,
        _slug: slug,
        _issue_prefix: issuePrefix || slug.toUpperCase().slice(0, 3),
      });

    if (error) {
      console.error('Team creation error:', error);
      throw new Error(error.message || 'Failed to create team');
    }

    if (!team) throw new Error('Failed to create team');

    return team as Team;
  },

  async updateTeam(teamId: string, updates: Partial<Team>): Promise<Team> {
    const { data, error } = await supabase
      .from('teams')
      .update(updates as any)
      .eq('id', teamId)
      .select()
      .single();

    if (error) throw error;
    return data as Team;
  },

  async deleteTeam(teamId: string): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) throw error;
  },
};

// ============================================
// TEAM MEMBER SERVICES
// ============================================

export interface TeamMemberWithProfile extends TeamMember {
  profile: Profile;
}

export const teamMemberService = {
  async getMembers(teamId: string): Promise<TeamMemberWithProfile[]> {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        profile:profiles!team_members_user_id_fkey(*)
      `)
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return (data || []) as unknown as TeamMemberWithProfile[];
  },

  async addMember(teamId: string, userId: string, role: TeamRole = 'member'): Promise<TeamMember> {
    const { data, error } = await supabase
      .from('team_members')
      .insert({ team_id: teamId, user_id: userId, role } as any)
      .select()
      .single();

    if (error) throw error;
    return data as TeamMember;
  },

  async updateMemberRole(memberId: string, role: TeamRole): Promise<TeamMember> {
    // Get current member info for logging old role
    const { data: currentMember } = await supabase
      .from('team_members')
      .select('team_id, user_id, role')
      .eq('id', memberId)
      .single();

    const oldRole = currentMember?.role;
    const teamId = currentMember?.team_id;
    const userId = currentMember?.user_id;

    const { data, error } = await supabase
      .from('team_members')
      .update({ role } as any)
      .eq('id', memberId)
      .select()
      .single();

    if (error) throw error;

    // Log role change activity
    if (teamId && userId && oldRole !== role) {
      logRoleChanged(teamId, memberId, userId, oldRole, role);
    }

    return data as TeamMember;
  },

  async removeMember(memberId: string): Promise<void> {
    // First, get the member info for notification/logging
    const { data: member, error: fetchError } = await supabase
      .from('team_members')
      .select(`
        *,
        team:teams(id, name),
        profile:profiles(id, email, name)
      `)
      .eq('id', memberId)
      .single();

    if (fetchError) throw fetchError;
    if (!member) throw new Error('Member not found');

    const typedMember = member as any;
    const teamId = typedMember.team_id;
    const removedUserId = typedMember.user_id;
    const teamName = typedMember.team?.name || 'the team';
    const userEmail = typedMember.profile?.email;
    const userName = typedMember.profile?.name || userEmail;
    const userRole = typedMember.role;

    // Delete the member
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;

    // Get current user info for notification message
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', currentUser?.id)
      .maybeSingle();
    const removerName = currentProfile?.name || currentProfile?.email || 'A team admin';

    // Create notification for removed user
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: removedUserId,
          type: 'team_removed',
          title: `You have been removed from ${teamName}`,
          message: `${removerName} has removed you from ${teamName}.`,
          data: {
            teamId,
            teamName,
            removedBy: currentUser?.id,
            removerName,
          },
        } as any);
    } catch (notifErr) {
      console.error('Failed to create removal notification:', notifErr);
    }

    // Send email notification via Edge Function
    if (userEmail) {
      try {
        await supabase.functions.invoke('send-member-removed', {
          body: {
            email: userEmail,
            userName,
            teamName,
            removerName,
          },
        });
      } catch (emailErr) {
        console.error('Failed to send removal email:', emailErr);
      }
    }

    // Log activity
    logMemberRemoved(teamId, memberId, removedUserId, userRole);
  },

  async getUserRole(teamId: string, userId: string): Promise<TeamRole | null> {
    const { data, error } = await supabase
      .rpc('get_team_role', { _user_id: userId, _team_id: teamId } as any);

    if (error) return null;
    return data as TeamRole | null;
  },
};

// ============================================
// TEAM INVITE SERVICES
// ============================================

export const teamInviteService = {
  async getInvites(teamId: string): Promise<TeamInvite[]> {
    const { data, error } = await supabase
      .from('team_invites')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as TeamInvite[];
  },

  async createInvite(teamId: string, email: string, role: TeamRole = 'member'): Promise<TeamInvite & { isExistingUser?: boolean }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get user profile for inviter name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single();

    // Get team info
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single();

    // Check if the email belongs to an existing user
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('email', email)
      .single();

    const isExistingUser = !!existingProfile;

    // Generate a unique token
    const token = crypto.randomUUID();

    // Set expiration to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('team_invites')
      .insert({
        team_id: teamId,
        email,
        role,
        invited_by: user.id,
        token,
        status: 'pending',
        expires_at: expiresAt,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Failed to create invite:', error);
      throw error;
    }

    const inviterName = profile?.name || user.email?.split('@')[0] || 'A team member';
    const teamName = team?.name || 'Team';

    // Notification creation is now handled by the Edge Function to bypass RLS
    if (isExistingUser && existingProfile) {
      console.log('Existing user detected, Edge Function will handle notification');
    }

    // Call Edge Function to send email
    try {
      const payload = {
        inviteId: data.id,
        email: email,
        teamName: teamName,
        inviterName: inviterName,
        role: role,
        token: token,
        isExistingUser: isExistingUser,
        targetUserId: existingProfile?.id,
      };

      console.log('Sending invitation payload to edge function:', payload);

      // Use supabase.functions.invoke for handled auth (auto-refresh, headers)
      const { data: funcData, error: funcError } = await supabase.functions.invoke('send-team-invite', {
        body: payload,
      });

      if (funcError) {
        console.error('Failed to send invitation email:', funcError);
      } else {
        console.log('Invitation email sent successfully', funcData);
      }
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the invite creation if email fails
    }

    // Log activity
    logInviteSent(teamId, data.id, email, role, isExistingUser);

    return { ...data, isExistingUser } as TeamInvite & { isExistingUser?: boolean };
  },

  async cancelInvite(inviteId: string): Promise<void> {
    // Get invite info for logging before cancelling
    const { data: invite } = await supabase
      .from('team_invites')
      .select('team_id, email')
      .eq('id', inviteId)
      .maybeSingle();

    const { error } = await supabase
      .from('team_invites')
      .update({ status: 'cancelled' } as any)
      .eq('id', inviteId);

    if (error) throw error;

    // Log activity
    if (invite) {
      logInviteCancelled(invite.team_id, inviteId, invite.email);
    }
  },

  async acceptInvite(token: string): Promise<Team> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // First check if invite exists at all (any status)
    const { data: anyInvite, error: anyInviteError } = await supabase
      .from('team_invites')
      .select('*, team:teams(*)')
      .eq('token', token)
      .maybeSingle();

    if (anyInviteError) throw anyInviteError;

    // Check invite status
    if (!anyInvite) {
      throw new Error('INVITE_NOT_FOUND');
    }

    if (anyInvite.status === 'cancelled') {
      throw new Error('This invitation has been cancelled');
    }

    if (anyInvite.status === 'accepted') {
      throw new Error('This invitation has already been accepted');
    }

    if (anyInvite.status !== 'pending') {
      throw new Error('INVITE_INVALID_STATUS');
    }

    // Check if invite has expired (24 hours)
    if (anyInvite.expires_at && new Date(anyInvite.expires_at) < new Date()) {
      throw new Error('This invitation has expired (24 hours have passed)');
    }

    const typedInvite = anyInvite as any;

    // Check if already a member - use maybeSingle to avoid error
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', typedInvite.team_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      // Add as team member
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: typedInvite.team_id,
          user_id: user.id,
          role: typedInvite.role,
        } as any);

      if (memberError) throw memberError;
    }

    // Mark invite as accepted
    await supabase
      .from('team_invites')
      .update({ status: 'accepted' } as any)
      .eq('id', typedInvite.id);

    // Create notification for inviter
    try {
      const { data: accepterProfile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', user.id)
        .maybeSingle();

      await supabase
        .from('notifications')
        .insert({
          user_id: typedInvite.invited_by,
          type: 'invite_accepted',
          title: `${accepterProfile?.name || accepterProfile?.email || 'A user'} accepted your invitation`,
          message: `${accepterProfile?.name || accepterProfile?.email} has joined ${typedInvite.team.name}`,
          data: {
            teamId: typedInvite.team_id,
            teamName: typedInvite.team.name,
            acceptedBy: user.id,
          },
        } as any);
    } catch (notifError) {
      console.error('Failed to create acceptance notification:', notifError);
    }

    // Log activity
    logInviteAccepted(typedInvite.team_id, typedInvite.id, user.id);

    // Ensure team data exists (handle case where join didn't fetch team)
    if (!typedInvite.team) {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', typedInvite.team_id)
        .single();

      if (teamError) throw teamError;
      return teamData as Team;
    }

    return typedInvite.team as Team;
  },

  async rejectInvite(token: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get invite - use maybeSingle to handle not found gracefully
    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .select('*, team:teams(*)')
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invite) throw new Error('Invite not found or expired');

    const typedInvite = invite as any;

    // Mark invite as rejected
    await supabase
      .from('team_invites')
      .update({ status: 'rejected' } as any)
      .eq('id', typedInvite.id);

    // Create notification for inviter
    try {
      const { data: rejecterProfile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', user.id)
        .single();

      await supabase
        .from('notifications')
        .insert({
          user_id: typedInvite.invited_by,
          type: 'invite_rejected',
          title: `${rejecterProfile?.name || rejecterProfile?.email || 'A user'} declined your invitation`,
          message: `${rejecterProfile?.name || rejecterProfile?.email} declined to join ${typedInvite.team.name}`,
          data: {
            teamId: typedInvite.team_id,
            teamName: typedInvite.team.name,
            rejectedBy: user.id,
          },
        } as any);
    } catch (notifError) {
      console.error('Failed to create rejection notification:', notifError);
    }
  },

  async checkInviteValidity(token: string): Promise<{ valid: boolean; status: 'pending' | 'expired' | 'cancelled' | 'accepted' | 'rejected' | 'not_found' }> {
    try {
      const { data: invite, error } = await supabase
        .from('team_invites')
        .select('status, expires_at')
        .eq('token', token)
        .maybeSingle();

      if (error) {
        console.error('Failed to check invite validity:', error);
        return { valid: false, status: 'not_found' };
      }

      if (!invite) {
        return { valid: false, status: 'not_found' };
      }

      // Check if expired
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        return { valid: false, status: 'expired' };
      }

      // Check status
      if (invite.status !== 'pending') {
        return { valid: false, status: invite.status as any };
      }

      return { valid: true, status: 'pending' };
    } catch (error) {
      console.error('Failed to check invite validity:', error);
      return { valid: false, status: 'not_found' };
    }
  },

  async getInvitePreview(token: string): Promise<{
    valid: boolean;
    status: 'pending' | 'expired' | 'cancelled' | 'accepted' | 'rejected' | 'not_found';
    teamName?: string;
    inviterName?: string;
    inviterAvatar?: string;
    email?: string;
    role?: string;
  }> {
    try {
      // Method 1: Use RPC function with SECURITY DEFINER (bypasses RLS)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_invite_preview', {
        invite_token: token,
      });

      if (!rpcError && rpcData) {
        console.log('RPC invite preview success:', rpcData);
        return rpcData;
      }

      console.warn('RPC failed, trying Edge Function:', rpcError);

      // Method 2: Use Edge Function to bypass RLS for unauthenticated users
      const { data, error } = await supabase.functions.invoke('get-invite-preview', {
        body: { token },
      });

      // If Edge Function works, return data
      if (!error && data) {
        console.log('Edge Function invite preview success:', data);
        return data;
      }

      console.warn('Edge Function failed, trying direct query:', error);

      // Method 3: Fall back to direct query (for authenticated users only)
      return this.getInvitePreviewDirect(token);
    } catch (error) {
      console.error('Failed to get invite preview:', error);
      return { valid: false, status: 'not_found' };
    }
  },

  // Direct query fallback for authenticated users
  async getInvitePreviewDirect(token: string): Promise<{
    valid: boolean;
    status: 'pending' | 'expired' | 'cancelled' | 'accepted' | 'rejected' | 'not_found';
    teamName?: string;
    inviterName?: string;
    email?: string;
  }> {
    try {
      const { data: invite, error } = await supabase
        .from('team_invites')
        .select(`
          status,
          expires_at,
          email,
          team:teams(name),
          inviter:profiles!team_invites_invited_by_fkey(name)
        `)
        .eq('token', token)
        .maybeSingle();

      if (error) {
        console.error('Failed to get invite preview:', error);
        return { valid: false, status: 'not_found' };
      }

      if (!invite) {
        return { valid: false, status: 'not_found' };
      }

      // Check if expired
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        return {
          valid: false,
          status: 'expired',
          teamName: (invite.team as any)?.name,
          inviterName: (invite.inviter as any)?.name,
          email: invite.email,
        };
      }

      // Check status
      if (invite.status !== 'pending') {
        return {
          valid: false,
          status: invite.status as any,
          teamName: (invite.team as any)?.name,
          inviterName: (invite.inviter as any)?.name,
          email: invite.email,
        };
      }

      return {
        valid: true,
        status: 'pending',
        teamName: (invite.team as any)?.name,
        inviterName: (invite.inviter as any)?.name,
        email: invite.email,
      };
    } catch (error) {
      console.error('Failed to get invite preview (direct):', error);
      return { valid: false, status: 'not_found' };
    }
  },
};
