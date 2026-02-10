import { supabase } from '@/lib/supabase';
import type { Profile, TeamMember, TeamRole } from '@/types/database';
import { logRoleChanged, logMemberRemoved } from '../activityService';

// ============================================
// TEAM MEMBER SERVICES
// ============================================

export interface TeamMemberWithProfile extends TeamMember {
    profile: Profile;
}

export const teamMemberService = {
    async getMembers(teamId: string): Promise<TeamMemberWithProfile[]> {
        // Step 1: Get team members
        const { data: membersData, error: membersError } = await supabase
            .from('team_members')
            .select('*')
            .eq('team_id', teamId)
            .order('joined_at', { ascending: true });

        if (membersError) throw membersError;
        if (!membersData || membersData.length === 0) return [];

        // Step 2: Get profiles for all member user_ids
        const userIds = membersData.map(m => m.user_id);
        const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, name, email, avatar_url')
            .in('id', userIds);

        if (profilesError) throw profilesError;

        // Step 3: Merge members with profiles
        const profileMap = new Map((profilesData || []).map(p => [p.id, p]));
        return membersData.map(member => ({
            ...member,
            profile: profileMap.get(member.user_id) || { id: member.user_id, name: null, email: null, avatar_url: null },
        })) as unknown as TeamMemberWithProfile[];
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
        team:teams(id, name)
      `)
            .eq('id', memberId)
            .single();

        if (fetchError) throw fetchError;
        if (!member) throw new Error('Member not found');

        const typedMember = member as any;
        const teamId = typedMember.team_id;
        const removedUserId = typedMember.user_id;
        const teamName = typedMember.team?.name || 'the team';

        // Get profile separately (FK hint doesn't work for auth.users → profiles)
        const { data: memberProfile } = await supabase
            .from('profiles')
            .select('id, email, name')
            .eq('id', removedUserId)
            .maybeSingle();

        const userEmail = memberProfile?.email;
        const userName = memberProfile?.name || userEmail;
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

    async getMemberByUserId(teamId: string, userId: string): Promise<TeamMember | null> {
        const { data, error } = await supabase
            .from('team_members')
            .select('*')
            .eq('team_id', teamId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error getting member by user ID:', error);
            return null;
        }
        return data as TeamMember | null;
    },

    async transferOwnership(teamId: string, newOwnerId: string, currentOwnerId: string): Promise<void> {
        // Update new owner to 'owner' role
        const { error: newOwnerError } = await supabase
            .from('team_members')
            .update({ role: 'owner' } as any)
            .eq('team_id', teamId)
            .eq('user_id', newOwnerId);

        if (newOwnerError) throw newOwnerError;

        // Update current owner to 'admin' role
        const { error: currentOwnerError } = await supabase
            .from('team_members')
            .update({ role: 'admin' } as any)
            .eq('team_id', teamId)
            .eq('user_id', currentOwnerId);

        if (currentOwnerError) throw currentOwnerError;
    },
};
