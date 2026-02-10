import { supabase } from '@/lib/supabase';
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
        let query = supabase
            .from('issues')
            .select(`
        *,
        project:projects(*)
      `)
            .eq('team_id', teamId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (filters?.status?.length) {
            query = query.in('status', filters.status);
        }
        if (filters?.priority?.length) {
            query = query.in('priority', filters.priority);
        }
        if (filters?.assignee_id?.length) {
            query = query.in('assignee_id', filters.assignee_id);
        }
        if (filters?.project_id?.length) {
            query = query.in('project_id', filters.project_id);
        }
        if (filters?.search) {
            const escapedSearch = filters.search.replace(/[%_\\]/g, '\\$&');
            query = query.or(`title.ilike.%${escapedSearch}%,identifier.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%`);
        }

        const { data, error } = await query;

        if (error) throw error;
        return (data || []) as unknown as IssueWithRelations[];
    },

    async getIssue(issueId: string): Promise<IssueWithRelations | null> {
        const { data, error } = await supabase
            .from('issues')
            .select(`
        *,
        project:projects(*)
      `)
            .eq('id', issueId)
            .single();

        if (error) throw error;
        return data as unknown as IssueWithRelations;
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: identifier, error: idError } = await supabase
            .rpc('generate_issue_identifier', { _team_id: teamId } as any);

        if (idError) throw idError;

        const { data: issue, error } = await supabase
            .from('issues')
            .insert({
                team_id: teamId,
                identifier: identifier as string,
                title: issueData.title,
                description: issueData.description,
                status: issueData.status || 'backlog',
                priority: issueData.priority || 'none',
                project_id: issueData.project_id,
                cycle_id: issueData.cycle_id,
                assignee_id: issueData.assignee_id,
                creator_id: user.id,
                estimate: issueData.estimate,
                due_date: issueData.due_date,
                parent_id: issueData.parent_id,
            } as any)
            .select()
            .single();

        if (error) throw error;
        if (!issue) throw new Error('Failed to create issue');

        await issueActivityService.createActivity((issue as Issue).id, 'issue_created', {
            title: (issue as Issue).title,
        });

        return issue as Issue;
    },

    async updateIssue(issueId: string, updates: Partial<Issue>): Promise<Issue> {
        const { data: current } = await supabase
            .from('issues')
            .select('*')
            .eq('id', issueId)
            .single();

        const dbUpdates: Record<string, any> = { ...updates };

        const { data, error } = await supabase
            .from('issues')
            .update(dbUpdates)
            .eq('id', issueId)
            .select()
            .single();

        if (error) throw error;

        if (current) {
            const curr = current as Issue;
            if (updates.status && updates.status !== curr.status) {
                await issueActivityService.createActivity(issueId, 'status_changed', {
                    from: curr.status,
                    to: updates.status,
                });
            }
            if (updates.priority && updates.priority !== curr.priority) {
                await issueActivityService.createActivity(issueId, 'priority_changed', {
                    from: curr.priority,
                    to: updates.priority,
                });
            }
            if (updates.assignee_id !== undefined && updates.assignee_id !== curr.assignee_id) {
                await issueActivityService.createActivity(issueId, 'assignee_changed', {
                    from: curr.assignee_id,
                    to: updates.assignee_id,
                });
            }
            if ((updates as any).type && (updates as any).type !== (curr as any).type) {
                await issueActivityService.createActivity(issueId, 'type_changed' as any, {
                    from: (curr as any).type,
                    to: (updates as any).type,
                });
            }
        }

        return data as Issue;
    },

    async deleteIssue(issueId: string): Promise<void> {
        const { error } = await supabase
            .from('issues')
            .delete()
            .eq('id', issueId);

        if (error) throw error;
    },

    async batchUpdateIssues(issueIds: string[], updates: Partial<Issue>): Promise<void> {
        const { error } = await supabase
            .from('issues')
            .update(updates as any)
            .in('id', issueIds);

        if (error) throw error;
    },

    async getSubIssues(parentId: string): Promise<Issue[]> {
        const { data, error } = await supabase
            .from('issues')
            .select('*')
            .eq('parent_id', parentId)
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return (data || []) as Issue[];
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const identifiers = await Promise.all(
            issues.map(() =>
                supabase.rpc('generate_issue_identifier', { _team_id: teamId } as any)
                    .then(({ data }) => data as string)
            )
        );

        const issueRecords = issues.map((issue, index) => ({
            team_id: teamId,
            identifier: identifiers[index],
            title: issue.title,
            description: issue.description,
            status: issue.status || 'backlog',
            priority: issue.priority || 'none',
            type: issue.type || 'task',
            estimate: issue.estimate,
            creator_id: user.id,
        }));

        const { data, error } = await supabase
            .from('issues')
            .insert(issueRecords as any)
            .select();

        if (error) throw error;
        return (data || []) as Issue[];
    },

    /** Archive a single issue by setting archived_at timestamp */
    async archiveIssue(issueId: string): Promise<void> {
        const { error } = await supabase
            .from('issues')
            .update({ archived_at: new Date().toISOString() })
            .eq('id', issueId);

        if (error) throw error;
    },

    /** Archive multiple issues at once */
    async archiveIssues(issueIds: string[]): Promise<void> {
        if (issueIds.length === 0) return;

        const { error } = await supabase
            .from('issues')
            .update({ archived_at: new Date().toISOString() })
            .in('id', issueIds);

        if (error) throw error;
    },

    /** Restore a single archived issue */
    async restoreIssue(issueId: string): Promise<void> {
        const { error } = await supabase
            .from('issues')
            .update({ archived_at: null })
            .eq('id', issueId);

        if (error) throw error;
    },

    /** Restore multiple archived issues */
    async restoreIssues(issueIds: string[]): Promise<void> {
        if (issueIds.length === 0) return;

        const { error } = await supabase
            .from('issues')
            .update({ archived_at: null })
            .in('id', issueIds);

        if (error) throw error;
    },
};
