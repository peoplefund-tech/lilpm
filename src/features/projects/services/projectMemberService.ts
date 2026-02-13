import { apiClient } from '@/lib/api/client';
import type { ProjectMemberRole, Project } from '@/types/database';

interface ProjectMemberData {
    id: string;
    userId: string;
    role: ProjectMemberRole;
    assignedAt: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
}

/**
 * Service for managing project-level member assignments
 * Controls per-project access for team members
 */
export const projectMemberService = {
    /**
     * Get all members assigned to a project
     */
    async getProjectMembers(projectId: string): Promise<ProjectMemberData[]> {
        const res = await apiClient.get<ProjectMemberData[]>(`/projects/${projectId}/members`);
        if (res.error) {
            console.error('Failed to get project members:', res.error);
            throw new Error(res.error);
        }
        return res.data || [];
    },

    /**
     * Get all projects a user is assigned to
     */
    async getUserProjects(userId: string, teamId?: string): Promise<{ project: Project; role: ProjectMemberRole }[]> {
        const endpoint = teamId
            ? `/${teamId}/projects/user/${userId}`
            : `/projects/user/${userId}`;

        const res = await apiClient.get<{ project: Project; role: ProjectMemberRole }[]>(endpoint);
        if (res.error) {
            console.error('Failed to get user projects:', res.error);
            throw new Error(res.error);
        }
        return res.data || [];
    },

    /**
     * Assign a user to a project (admin only)
     */
    async assignMember(projectId: string, userId: string, role: ProjectMemberRole = 'member'): Promise<string> {
        const res = await apiClient.post<{ id: string }>(`/projects/${projectId}/members`, {
            userId,
            role,
        });
        if (res.error) {
            console.error('Failed to assign project member:', res.error);
            throw new Error(res.error);
        }
        return res.data?.id || '';
    },

    /**
     * Remove a user from a project (admin only)
     */
    async unassignMember(projectId: string, userId: string): Promise<boolean> {
        const res = await apiClient.delete<{ success: boolean }>(`/projects/${projectId}/members/${userId}`);
        if (res.error) {
            console.error('Failed to unassign project member:', res.error);
            throw new Error(res.error);
        }
        return res.data?.success ?? false;
    },

    /**
     * Check if a user is assigned to a project
     */
    async isProjectMember(projectId: string, userId: string): Promise<boolean> {
        try {
            const res = await apiClient.get<ProjectMemberData>(`/projects/${projectId}/members/${userId}`);
            if (res.error) {
                return false;
            }
            return !!res.data;
        } catch {
            return false;
        }
    },

    /**
     * Update a member's role in a project
     */
    async updateMemberRole(projectId: string, userId: string, role: ProjectMemberRole): Promise<void> {
        const res = await apiClient.put<void>(`/projects/${projectId}/members/${userId}`, {
            role,
        });
        if (res.error) {
            console.error('Failed to update member role:', res.error);
            throw new Error(res.error);
        }
    },
};
