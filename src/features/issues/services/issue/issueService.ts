import { apiClient } from '@/lib/api/client';
import type {
    Issue,
    IssueStatus,
    IssuePriority,
    Profile,
    Project
} from '@/types/database';
import { issueActivityService } from './issueActivityService';

// Extended types with relations
export interface IssueWithRelations extends Issue {
    assignee?: Profile | null;
    creator?: Profile | null;
    project?: Project | null;
}

// ============================================
// ISSUE SERVICES
// ============================================

export const issueService = {
    async getIssues(
        teamId: string,
        filters?: {
            status?: IssueStatus[];
            priority?: IssuePriority[];
            assignee_id?: string[];
            project_id?: string[];
            search?: string;
        }
    ): Promise<IssueWithRelations[]> {
        const params = new URLSearchParams();
        if (filters?.status?.length) params.set('status', filters.status.join(','));
        if (filters?.priority?.length) params.set('priority', filters.priority.join(','));
        if (filters?.assignee_id?.length) params.set('assigneeId', filters.assignee_id.join(','));
        if (filters?.project_id?.length) params.set('projectId', filters.project_id.join(','));
        if (filters?.search) params.set('search', filters.search);

        const qs = params.toString();
        const res = await apiClient.get<IssueWithRelations[]>(
            `/${teamId}/issues${qs ? `?${qs}` : ''}`
        );
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },

    async getIssue(issueId: string): Promise<IssueWithRelations | null> {
        // We need teamId context — use a generic lookup endpoint
        const res = await apiClient.get<IssueWithRelations>(`/issues/${issueId}`);
        if (res.error) throw new Error(res.error);
        return res.data || null;
    },

    async createIssue(
        teamId: string,
        issueData: {
            title: string;
            description?: string;
            status?: IssueStatus;
            priority?: IssuePriority;
            project_id?: string;
            cycle_id?: string;
            assignee_id?: string;
            estimate?: number;
            due_date?: string;
            parent_id?: string;
        }
    ): Promise<Issue> {
        const res = await apiClient.post<Issue>(`/${teamId}/issues`, issueData);
        if (res.error) throw new Error(res.error);
        if (!res.data) throw new Error('Failed to create issue');
        return res.data;
    },

    async updateIssue(issueId: string, updates: Partial<Issue>): Promise<Issue> {
        const res = await apiClient.put<Issue>(`/issues/${issueId}`, updates);
        if (res.error) throw new Error(res.error);
        return res.data as Issue;
    },

    async deleteIssue(issueId: string): Promise<void> {
        const res = await apiClient.delete(`/issues/${issueId}`);
        if (res.error) throw new Error(res.error);
    },

    async batchUpdateIssues(issueIds: string[], updates: Partial<Issue>): Promise<void> {
        const res = await apiClient.put('/issues/batch', { issueIds, updates });
        if (res.error) throw new Error(res.error);
    },

    async getSubIssues(parentId: string): Promise<Issue[]> {
        const res = await apiClient.get<Issue[]>(`/issues/${parentId}/sub-issues`);
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },

    async batchCreateIssues(
        teamId: string,
        issues: Array<{
            title: string;
            description?: string;
            status?: IssueStatus;
            priority?: IssuePriority;
            type?: string;
            estimate?: number;
        }>
    ): Promise<Issue[]> {
        const res = await apiClient.post<Issue[]>(`/${teamId}/issues/batch`, { issues });
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },

    /** Archive a single issue by setting archived_at timestamp */
    async archiveIssue(issueId: string): Promise<void> {
        const res = await apiClient.post(`/issues/${issueId}/archive`);
        if (res.error) throw new Error(res.error);
    },

    /** Archive multiple issues at once */
    async archiveIssues(issueIds: string[]): Promise<void> {
        if (issueIds.length === 0) return;
        const res = await apiClient.post('/issues/batch/archive', { issueIds });
        if (res.error) throw new Error(res.error);
    },

    /** Restore a single archived issue */
    async restoreIssue(issueId: string): Promise<void> {
        const res = await apiClient.post(`/issues/${issueId}/restore`);
        if (res.error) throw new Error(res.error);
    },

    /** Restore multiple archived issues */
    async restoreIssues(issueIds: string[]): Promise<void> {
        if (issueIds.length === 0) return;
        const res = await apiClient.post('/issues/batch/restore', { issueIds });
        if (res.error) throw new Error(res.error);
    },
};
