import { apiClient } from '@/lib/api/client';
import type { Team, TeamInvite, TeamRole } from '@/types/database';
import { logInviteSent, logInviteCancelled, logInviteAccepted } from '../activityService';

// ============================================
// TEAM INVITE SERVICES
// ============================================

export const teamInviteService = {
    async getInvites(teamId: string): Promise<TeamInvite[]> {
        console.log('[getInvites] Fetching invites for team:', teamId);
        const res = await apiClient.get<TeamInvite[]>(`/invites?teamId=${teamId}`);

        if (res.error) {
            console.error('[getInvites] Error:', res.error);
            throw new Error(res.error);
        }
        console.log('[getInvites] Found invites:', res.data?.length || 0, res.data);
        return res.data || [];
    },

    async createInvite(teamId: string, email: string, role: TeamRole = 'member', projectIds?: string[]): Promise<TeamInvite & { isExistingUser?: boolean }> {
        // Server handles all the logic: fetching profiles, checking existing users, sending email
        const res = await apiClient.post<TeamInvite & { isExistingUser?: boolean }>('/invites/send', {
            teamId,
            email,
            role,
            projectIds,
        });

        if (res.error) {
            console.error('Failed to create invite:', res.error);
            throw new Error(res.error);
        }

        const data = res.data;
        const isExistingUser = data?.isExistingUser ?? false;

        // Log activity
        logInviteSent(teamId, data.id, email, role, isExistingUser);

        return data;
    },

    async cancelInvite(inviteId: string): Promise<void> {
        const res = await apiClient.put<void>(`/invites/${inviteId}/cancel`, {});

        if (res.error) {
            throw new Error(res.error);
        }

        // Activity logging is handled server-side
    },

    async acceptInvite(token: string): Promise<Team> {
        // Server handles all validation, member creation, notifications
        const res = await apiClient.post<{ action: string; teamId: string; teamName: string; team?: Team }>('/invites/accept', {
            token,
        });

        if (res.error) {
            throw new Error(res.error);
        }

        const data = res.data;

        // Log activity
        logInviteAccepted(data.teamId, '', ''); // Activity logged server-side

        // Return the team (server provides full team object if available)
        if (data.team) {
            return data.team;
        }

        // Fallback to minimal team object
        return {
            id: data.teamId,
            name: data.teamName,
        } as Team;
    },

    async rejectInvite(token: string): Promise<void> {
        // Server handles all validation and notifications
        const res = await apiClient.post<void>('/invites/reject', {
            token,
        });

        if (res.error) {
            throw new Error(res.error);
        }

        // Activity and notifications logged server-side
    },

    async checkInviteValidity(token: string): Promise<{ valid: boolean; status: 'pending' | 'expired' | 'cancelled' | 'accepted' | 'rejected' | 'not_found' }> {
        try {
            const res = await apiClient.post<{ valid: boolean; status: 'pending' | 'expired' | 'cancelled' | 'accepted' | 'rejected' | 'not_found' }>('/invites/check', {
                token,
            });

            if (res.error) {
                return { valid: false, status: 'not_found' };
            }

            return res.data;
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
        projectNames?: string[];
    }> {
        try {
            const res = await apiClient.post<{
                valid: boolean;
                status: 'pending' | 'expired' | 'cancelled' | 'accepted' | 'rejected' | 'not_found';
                teamName?: string;
                inviterName?: string;
                inviterAvatar?: string;
                email?: string;
                role?: string;
                projectNames?: string[];
            }>('/invites/preview', {
                token,
            });

            if (res.error) {
                console.error('Invite preview query error:', res.error);
                return { valid: false, status: 'not_found' };
            }

            return res.data;
        } catch (error) {
            console.error('getInvitePreview error:', error);
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
            const res = await apiClient.post<{
                valid: boolean;
                status: 'pending' | 'expired' | 'cancelled' | 'accepted' | 'rejected' | 'not_found';
                teamName?: string;
                inviterName?: string;
                email?: string;
            }>('/invites/preview', {
                token,
            });

            if (res.error) {
                return { valid: false, status: 'not_found' };
            }

            return res.data;
        } catch (error) {
            return { valid: false, status: 'not_found' };
        }
    },
};
