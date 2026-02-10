import { supabase } from '@/lib/supabase';

// ============================================
// DEPENDENCY SERVICES
// ============================================

export const dependencyService = {
    async getDependencies(teamId: string) {
        const { data, error } = await supabase
            .from('issue_dependencies')
            .select('*')

        if (error) throw error;

        // Filter by team_id in code since we can't do FK join easily
        if (!data) return [];

        // Get all issue IDs referenced
        const issueIds = [...new Set(data.flatMap(d => [d.issue_id, d.depends_on_id].filter(Boolean)))];
        if (issueIds.length === 0) return [];

        // Get issues with team_id filter
        const { data: issues } = await supabase
            .from('issues')
            .select('id, team_id')
            .in('id', issueIds)
            .eq('team_id', teamId);

        const teamIssueIds = new Set((issues || []).map(i => i.id));

        // Only return dependencies where the source issue belongs to the team
        return data
            .filter(d => teamIssueIds.has(d.issue_id))
            .map(d => ({
                ...d,
                source_issue_id: d.issue_id,
                target_issue_id: d.depends_on_id,
            }));
    },

    async createDependency(sourceIssueId: string, targetIssueId: string) {
        const { data, error } = await supabase
            .from('issue_dependencies')
            .insert({
                issue_id: sourceIssueId,
                depends_on_id: targetIssueId,
            } as any)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteDependency(sourceIssueId: string, targetIssueId: string) {
        const { error } = await supabase
            .from('issue_dependencies')
            .delete()
            .eq('issue_id', sourceIssueId)
            .eq('depends_on_id', targetIssueId);

        if (error) throw error;
    }
};
