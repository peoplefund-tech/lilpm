import { apiClient } from '@/lib/api/client';
import type { Team } from '@/types';

// ============================================
// TEAM SERVICES
// ============================================

export const teamService = {
    async getTeams(): Promise<Team[]> {
        // Server handles auth via JWT — fetch user's teams from /teams endpoint
        const res = await apiClient.get<Team[]>('/teams');
        if (res.error) {
            console.error('Failed to load teams:', res.error);
            throw new Error(res.error);
        }

        return res.data || [];
    },

    async getTeam(teamId: string): Promise<Team | null> {
        const res = await apiClient.get<Team>(`/teams/${teamId}`);
        if (res.error) throw new Error(res.error);
        return res.data || null;
    },

    async createTeam(name: string, slug: string, issuePrefix?: string): Promise<Team> {
        // Server handles auth validation and owner assignment atomically
        const res = await apiClient.post<Team>('/teams', {
            name,
            slug,
            issuePrefix: issuePrefix || slug.toUpperCase().slice(0, 3),
        });

        if (res.error) {
            console.error('Team creation error:', res.error);
            throw new Error(res.error || 'Failed to create team');
        }

        if (!res.data) throw new Error('Failed to create team');

        return res.data;
    },

    async updateTeam(teamId: string, updates: Partial<Team>): Promise<Team> {
        const res = await apiClient.put<Team>(`/teams/${teamId}`, updates);
        if (res.error) throw new Error(res.error);

        if (!res.data) throw new Error('Failed to update team');
        return res.data;
    },

    async deleteTeam(teamId: string): Promise<void> {
        const res = await apiClient.delete<void>(`/teams/${teamId}`);
        if (res.error) throw new Error(res.error);
    },
};
