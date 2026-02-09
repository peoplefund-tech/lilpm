import { supabase } from '@/lib/supabase';
import type { ProjectMember, ProjectMemberWithProfile, ProjectMemberRole, Project } from '@/types/database';

/**
 * Service for managing project-level member assignments
 * Controls per-project access for team members
 */
export const projectMemberService = {
    /**
     * Get all members assigned to a project
     */
    async getProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
        const { data, error } = await supabase
            .from('project_members')
            .select(`
        *,
        profile:profiles!project_members_user_id_fkey(*)
      `)
            .eq('project_id', projectId)
            .order('role', { ascending: true });

        if (error) {
            console.error('Failed to get project members:', error);
            throw error;
        }

        return (data || []) as ProjectMemberWithProfile[];
    },

    /**
     * Get all projects a user is assigned to
     */
    async getUserProjects(userId: string, teamId?: string): Promise<{ project: Project; role: ProjectMemberRole }[]> {
        let query = supabase
            .from('project_members')
            .select(`
        role,
        project:projects(*)
      `)
            .eq('user_id', userId);

        if (teamId) {
            query = query.eq('project.team_id', teamId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Failed to get user projects:', error);
            throw error;
        }

        return (data || []).filter(d => d.project).map(d => ({
            project: d.project as unknown as Project,
            role: d.role as ProjectMemberRole,
        }));
    },

    /**
     * Assign a user to a project (admin only)
     */
    async assignMember(projectId: string, userId: string, role: ProjectMemberRole = 'member'): Promise<string> {
        const { data, error } = await supabase
            .rpc('assign_project_member', {
                _project_id: projectId,
                _user_id: userId,
                _role: role,
            });

        if (error) {
            console.error('Failed to assign project member:', error);
            throw error;
        }

        return data as string;
    },

    /**
     * Remove a user from a project (admin only)
     */
    async unassignMember(projectId: string, userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .rpc('unassign_project_member', {
                _project_id: projectId,
                _user_id: userId,
            });

        if (error) {
            console.error('Failed to unassign project member:', error);
            throw error;
        }

        return data as boolean;
    },

    /**
     * Check if a user is assigned to a project
     */
    async isProjectMember(projectId: string, userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('project_members')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Failed to check project membership:', error);
        }

        return !!data;
    },

    /**
     * Update a member's role in a project
     */
    async updateMemberRole(projectId: string, userId: string, role: ProjectMemberRole): Promise<void> {
        const { error } = await supabase
            .from('project_members')
            .update({ role })
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) {
            console.error('Failed to update member role:', error);
            throw error;
        }
    },
};
