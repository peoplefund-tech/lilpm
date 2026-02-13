import { apiClient } from '@/lib/api/client';
import type { Activity, ActivityType, Profile } from '@/types/database';

// ============================================
// ISSUE ACTIVITY SERVICES
// ============================================

export interface ActivityWithUser extends Activity {
    user: Profile | null;
}

export const issueActivityService = {
    async getActivities(issueId: string): Promise<ActivityWithUser[]> {
        const res = await apiClient.get<ActivityWithUser[]>(`/issues/${issueId}/activities`);
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },

    async createActivity(
        issueId: string,
        type: ActivityType,
        activityData: Record<string, unknown>
    ): Promise<Activity> {
        const res = await apiClient.post<Activity>(`/issues/${issueId}/activities`, {
            type,
            data: activityData,
        });
        if (res.error) throw new Error(res.error);
        return res.data;
    },

    async getTeamActivities(teamId: string, limit = 50): Promise<ActivityWithUser[]> {
        const res = await apiClient.get<ActivityWithUser[]>(
            `/${teamId}/activities?limit=${limit}`
        );
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },
};
