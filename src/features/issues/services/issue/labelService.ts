import { apiClient } from '@/lib/api/client';
import type { Label } from '@/types/database';
import { issueActivityService } from './issueActivityService';

// ============================================
// LABEL SERVICES
// ============================================

export const labelService = {
    async getLabels(teamId: string): Promise<Label[]> {
        const res = await apiClient.get<Label[]>(`/${teamId}/labels`);
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },

    async createLabel(teamId: string, name: string, color: string, description?: string): Promise<Label> {
        const res = await apiClient.post<Label>(`/${teamId}/labels`, { name, color, description });
        if (res.error) throw new Error(res.error);
        return res.data;
    },

    async updateLabel(labelId: string, updates: Partial<Label>): Promise<Label> {
        const res = await apiClient.put<Label>(`/labels/${labelId}`, updates);
        if (res.error) throw new Error(res.error);
        return res.data;
    },

    async deleteLabel(labelId: string): Promise<void> {
        const res = await apiClient.delete(`/labels/${labelId}`);
        if (res.error) throw new Error(res.error);
    },

    async addLabelToIssue(issueId: string, labelId: string): Promise<void> {
        const res = await apiClient.post(`/issues/${issueId}/labels`, { label_id: labelId });
        if (res.error && !res.error.includes('duplicate')) throw new Error(res.error);

        await issueActivityService.createActivity(issueId, 'label_added', { label_id: labelId });
    },

    async removeLabelFromIssue(issueId: string, labelId: string): Promise<void> {
        const res = await apiClient.delete(`/issues/${issueId}/labels/${labelId}`);
        if (res.error) throw new Error(res.error);

        await issueActivityService.createActivity(issueId, 'label_removed', { label_id: labelId });
    },

    async getIssueLabels(issueId: string): Promise<Label[]> {
        const res = await apiClient.get<Label[]>(`/issues/${issueId}/labels`);
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },
};
