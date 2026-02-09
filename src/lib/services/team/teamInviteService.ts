import { supabase } from '@/lib/supabase';
import type { Team, TeamInvite, TeamRole } from '@/types/database';
import { logInviteSent, logInviteCancelled, logInviteAccepted } from '../activityService';

// ============================================
// TEAM INVITE SERVICES
// ============================================

export const teamInviteService = {
    async getInvites(teamId: string): Promise<TeamInvite[]> {
        console.log('[getInvites] Fetching invites for team:', teamId);
        const { data, error } = await supabase
            .from('team_invites')
            .select('*')
            .eq('team_id', teamId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[getInvites] Error:', error);
            throw error;
        }
        console.log('[getInvites] Found invites:', data?.length || 0, data);
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

            const { error: funcError } = await supabase.functions.invoke('send-team-invite', {
                body: payload,
            });

            if (funcError) {
                console.error('Failed to send invitation email:', funcError);
            }
        } catch (emailError) {
            console.error('Failed to send invitation email:', emailError);
        }

        // Log activity
        logInviteSent(teamId, data.id, email, role, isExistingUser);

        return { ...data, isExistingUser } as TeamInvite & { isExistingUser?: boolean };
    },

    async cancelInvite(inviteId: string): Promise<void> {
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

        if (invite) {
            logInviteCancelled(invite.team_id, inviteId, invite.email);
        }
    },

    async acceptInvite(token: string): Promise<Team> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: anyInvite, error: anyInviteError } = await supabase
            .from('team_invites')
            .select('*, team:teams(*)')
            .eq('token', token)
            .maybeSingle();

        if (anyInviteError) throw anyInviteError;

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

        if (anyInvite.expires_at && new Date(anyInvite.expires_at) < new Date()) {
            throw new Error('This invitation has expired (24 hours have passed)');
        }

        const typedInvite = anyInvite as any;

        // Check if already a member
        const { data: existing } = await supabase
            .from('team_members')
            .select('id')
            .eq('team_id', typedInvite.team_id)
            .eq('user_id', user.id)
            .maybeSingle();

        if (!existing) {
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

        logInviteAccepted(typedInvite.team_id, typedInvite.id, user.id);

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

        const { data: invite, error: inviteError } = await supabase
            .from('team_invites')
            .select('*, team:teams(*)')
            .eq('token', token)
            .eq('status', 'pending')
            .maybeSingle();

        if (inviteError) throw inviteError;
        if (!invite) throw new Error('Invite not found or expired');

        const typedInvite = invite as any;

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
                return { valid: false, status: 'not_found' };
            }

            if (!invite) {
                return { valid: false, status: 'not_found' };
            }

            if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
                return { valid: false, status: 'expired' };
            }

            if (invite.status !== 'pending') {
                return { valid: false, status: invite.status as any };
            }

            return { valid: true, status: 'pending' };
        } catch (error) {
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
            // Method 1: Use RPC function
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_invite_preview', {
                invite_token: token,
            });

            if (!rpcError && rpcData) {
                return rpcData;
            }

            // Method 2: Use Edge Function
            const { data, error } = await supabase.functions.invoke('get-invite-preview', {
                body: { token },
            });

            if (!error && data) {
                return data;
            }

            // Method 3: Fall back to direct query
            return this.getInvitePreviewDirect(token);
        } catch (error) {
            return { valid: false, status: 'not_found' };
        }
    },

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
          inviter:profiles(name)
        `)
                .eq('token', token)
                .maybeSingle();

            if (error || !invite) {
                return { valid: false, status: 'not_found' };
            }

            if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
                return {
                    valid: false,
                    status: 'expired',
                    teamName: (invite.team as any)?.name,
                    inviterName: (invite.inviter as any)?.name,
                    email: invite.email,
                };
            }

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
            return { valid: false, status: 'not_found' };
        }
    },
};
