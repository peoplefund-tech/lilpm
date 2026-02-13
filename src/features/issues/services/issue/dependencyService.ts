import { apiClient } from '@/lib/api/client';

// ============================================
// DEPENDENCY SERVICES
// ============================================

export const dependencyService = {
    async getDependencies(teamId: string) {
        const res = await apiClient.get<any[]>(`/${teamId}/dependencies`);
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },

    async createDependency(sourceIssueId: string, targetIssueId: string) {
        const res = await apiClient.post(`/issues/${sourceIssueId}/dependencies`, {
            depends_on_id: targetIssueId,
        });
        if (res.error) throw new Error(res.error);
        return res.data;
    },

    async deleteDependency(sourceIssueId: string, targetIssueId: string) {
        const res = await apiClient.delete(
            `/issues/${sourceIssueId}/dependencies/${targetIssueId}`
        );
        if (res.error) throw new Error(res.error);
    }
};
