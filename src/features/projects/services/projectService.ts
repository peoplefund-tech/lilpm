import { apiClient } from '@/lib/api/client';
import type { Project, ProjectStatus } from '@/types/database';

export const projectService = {
  async getProjects(teamId: string): Promise<Project[]> {
    const res = await apiClient.get<Project[]>(`/${teamId}/projects`);
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  async getProject(projectId: string): Promise<Project | null> {
    const res = await apiClient.get<Project>(`/projects/${projectId}`);
    if (res.error) throw new Error(res.error);
    return res.data || null;
  },

  async createProject(
    teamId: string,
    projectData: {
      name: string;
      slug?: string;
      description?: string;
      color?: string;
      icon?: string;
      lead_id?: string;
      start_date?: string;
      target_date?: string;
    }
  ): Promise<Project> {
    const slug = projectData.slug || projectData.name.toLowerCase().replace(/\s+/g, '-');

    const payload = {
      name: projectData.name,
      slug,
      description: projectData.description,
      color: projectData.color || '#6366F1',
      icon: projectData.icon,
      leadId: projectData.lead_id,
      startDate: projectData.start_date,
      targetDate: projectData.target_date,
      status: 'planned' as ProjectStatus,
    };

    const res = await apiClient.post<Project>(`/${teamId}/projects`, payload);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    const res = await apiClient.put<Project>(`/projects/${projectId}`, updates);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async deleteProject(projectId: string): Promise<void> {
    const res = await apiClient.delete<void>(`/projects/${projectId}`);
    if (res.error) throw new Error(res.error);
  },
};
