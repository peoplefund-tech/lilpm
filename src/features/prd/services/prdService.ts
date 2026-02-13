import { apiClient } from '@/lib/api/client';
import type { PRDDocument } from '@/types/database';

export type PRDStatus = 'draft' | 'review' | 'approved' | 'archived';

export interface PRDWithRelations extends PRDDocument {
  project?: { id: string; name: string } | null;
}

export const prdService = {
  async getPRDs(teamId: string): Promise<PRDWithRelations[]> {
    const res = await apiClient.get<PRDWithRelations[]>(`/${teamId}/prd`);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async getPRD(prdId: string): Promise<PRDWithRelations | null> {
    const res = await apiClient.get<PRDWithRelations>(`/prd/${prdId}`);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async createPRD(
    teamId: string,
    data: {
      title: string;
      overview?: string;
      goals?: string[];
      user_stories?: Array<{ persona: string; action: string; benefit: string }>;
      requirements?: Array<{ type: string; description: string; priority: string }>;
      timeline?: string;
      project_id?: string;
      conversation_id?: string;
    }
  ): Promise<PRDDocument> {
    const res = await apiClient.post<PRDDocument>(`/${teamId}/prd`, {
      title: data.title,
      overview: data.overview,
      goals: data.goals || [],
      userStories: data.user_stories || [],
      requirements: data.requirements || [],
      timeline: data.timeline,
      projectId: data.project_id,
      conversationId: data.conversation_id,
      status: 'draft',
    });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async updatePRD(prdId: string, updates: Partial<PRDDocument>): Promise<PRDDocument> {
    console.log('[prdService] Updating PRD:', prdId, updates);
    const res = await apiClient.put<PRDDocument>(`/prd/${prdId}`, updates);
    if (res.error) {
      console.error('[prdService] Update failed:', res.error);
      throw new Error(res.error);
    }
    console.log('[prdService] Update success:', res.data);
    return res.data;
  },

  async deletePRD(prdId: string): Promise<void> {
    const res = await apiClient.delete<void>(`/prd/${prdId}`);
    if (res.error) throw new Error(res.error);
  },

  async updateStatus(prdId: string, status: PRDStatus): Promise<PRDDocument> {
    return this.updatePRD(prdId, { status });
  },

  // PRD-Project linking functions (many-to-many)
  async linkToProject(prdId: string, projectId: string): Promise<void> {
    const res = await apiClient.post<void>(`/prd/${prdId}/projects`, {
      projectId,
    });
    if (res.error && !res.error.includes('duplicate')) {
      throw new Error(res.error);
    }
  },

  async unlinkFromProject(prdId: string, projectId: string): Promise<void> {
    const res = await apiClient.delete<void>(`/prd/${prdId}/projects/${projectId}`);
    if (res.error) throw new Error(res.error);
  },

  async getLinkedProjects(prdId: string): Promise<Array<{ id: string; name: string; icon?: string }>> {
    const res = await apiClient.get<Array<{ id: string; name: string; icon?: string }>>(`/prd/${prdId}/projects`);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async getPRDsForProject(projectId: string): Promise<PRDWithRelations[]> {
    const res = await apiClient.get<PRDWithRelations[]>(`/projects/${projectId}/prd`);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async updateProjectLinks(prdId: string, projectIds: string[]): Promise<void> {
    const res = await apiClient.put<void>(`/prd/${prdId}/projects`, {
      projectIds,
    });
    if (res.error) throw new Error(res.error);
  },
};
