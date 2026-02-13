import { apiClient } from '@/lib/api/client';
import type { Profile, TeamMember, TeamRole } from '@/types/database';
import { logRoleChanged, logMemberRemoved } from '../activityService';

// ============================================
// TEAM MEMBER SERVICES
// ============================================

// Storage for team context - used to support backward-compatible API
let currentTeamContext: string | null = null;

export interface TeamMemberWithProfile extends TeamMember {
    profile: Profile;
}

export const teamMemberService = {
    /**
     * Set the current team context (used for legacy API calls)
     * This is called from the store when loading members
     */
    setCurrentTeamContext(teamId: string | null) {
        currentTeamContext = teamId;
    },

    async getMembers(teamId: string): Promise<TeamMemberWithProfile[]> {
        // Set context for other methods
        this.setCurrentTeamContext(teamId);

        // Get team members with profiles via the API
        const res = await apiClient.get<any[]>(`/teams/${teamId}/members`);
        if (res.error) throw new Error(res.error);

        const members = res.data || [];

        // Transform the response to include the profile object for consistency
        return members.map(member => ({
            id: member.id,
            team_id: teamId,
            user_id: member.userId,
            role: member.role,
            joined_at: member.joinedAt,
            // The API returns name, email, avatarUrl as separate fields
            // Convert to profile object for interface compatibility
            profile: {
                id: member.userId,
                name: member.name,
                email: member.email,
                avatar_url: member.avatarUrl,
            },
        })) as unknown as TeamMemberWithProfile[];
    },

    async addMember(teamId: string, userId: string, role: TeamRole = 'member'): Promise<TeamMember> {
        const res = await apiClient.post<TeamMember>(`/teams/${teamId}/members`, { userId, role });
        if (res.error) throw new Error(res.error);
        return res.data;
    },

    async updateMemberRole(memberId: string, role: TeamRole): Promise<TeamMember> {
        // Legacy API: memberId corresponds to userId in the new API structure
        // We need the current team context to make the API call
        if (!currentTeamContext) {
            throw new Error('No team context set. Call getMembers first or use updateMemberRoleByTeamAndUser.');
        }

        const res = await apiClient.put<TeamMember>(`/teams/${currentTeamContext}/members/${memberId}`, { role });
        if (res.error) throw new Error(res.error);

        logRoleChanged(currentTeamContext, memberId, memberId, 'unknown', role);
        return res.data;
    },

    async updateMemberRoleByTeamAndUser(teamId: string, userId: string, role: TeamRole): Promise<TeamMember> {
        // Update member role via teamId and userId
        const res = await apiClient.put<TeamMember>(`/teams/${teamId}/members/${userId}`, { role });
        if (res.error) throw new Error(res.error);

        logRoleChanged(teamId, userId, userId, 'unknown', role);
        return res.data;
    },

    async removeMember(teamIdOrMemberId: string, userId?: string): Promise<void> {
        // Support both signatures for backward compatibility
        // If userId is provided, use it as the new API
        // Otherwise, treat first arg as memberId and use team context
        let teamId: string;
        let userIdToRemove: string;

        if (userId) {
            // New API: removeMember(teamId, userId)
            teamId = teamIdOrMemberId;
            userIdToRemove = userId;
        } else {
            // Legacy API: removeMember(memberId)
            if (!currentTeamContext) {
                throw new Error('No team context set. Call getMembers first or use removeMember(teamId, userId).');
            }
            teamId = currentTeamContext;
            userIdToRemove = teamIdOrMemberId;
        }

        // Delete the member via teamId and userId
        const res = await apiClient.delete(`/teams/${teamId}/members/${userIdToRemove}`);
        if (res.error) throw new Error(res.error);

        logMemberRemoved(teamId, userIdToRemove, userIdToRemove, 'unknown');
    },

    async getUserRole(teamId: string, userId: string): Promise<TeamRole | null> {
        try {
            // Get member details to extract role
            const res = await apiClient.get<any>(`/teams/${teamId}/members`);
            if (res.error) return null;

            const members = res.data || [];
            const member = members.find((m: any) => m.userId === userId);
            return member?.role || null;
        } catch {
            return null;
        }
    },

    async getMemberByUserId(teamId: string, userId: string): Promise<TeamMember | null> {
        try {
            // Get all members and find the one matching userId
            const res = await apiClient.get<any[]>(`/teams/${teamId}/members`);
            if (res.error) {
                console.error('Error getting members:', res.error);
                return null;
            }

            const members = res.data || [];
            const member = members.find((m: any) => m.userId === userId);

            if (!member) return null;

            // Transform to TeamMember interface
            return {
                id: member.id,
                team_id: teamId,
                user_id: member.userId,
                role: member.role,
                joined_at: member.joinedAt,
            } as TeamMember;
        } catch (err) {
            console.error('Error getting member by user ID:', err);
            return null;
        }
    },

    async transferOwnership(teamId: string, newOwnerId: string, currentOwnerId: string): Promise<void> {
        // Update new owner to 'owner' role
        const newOwnerRes = await apiClient.put(`/teams/${teamId}/members/${newOwnerId}`, { role: 'owner' });
        if (newOwnerRes.error) throw new Error(newOwnerRes.error);

        // Update current owner to 'admin' role
        const currentOwnerRes = await apiClient.put(`/teams/${teamId}/members/${currentOwnerId}`, { role: 'admin' });
        if (currentOwnerRes.error) throw new Error(currentOwnerRes.error);
    },
};
