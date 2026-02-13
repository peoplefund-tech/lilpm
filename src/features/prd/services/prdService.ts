import { apiClient } from '@/lib/api/client';
import type { PRDDocument } from '@/types/database';

export type PRDStatus = 'draft' | 'review' | 'approved' | 'archived';

export interface PRDWithRelations extends PRDDocument {
  project?: { id: string; name: string } | null;
}

/** API returns camelCase (Drizzle); frontend types use snake_case. Normalize to avoid format(undefined) → RangeError. */
function normalizePrdRow(row: Record<string, unknown>): PRDWithRelations {
  return {
    id: row.id as string,
    conversation_id: (row.conversationId ?? row.conversation_id) as string | null,
    team_id: (row.teamId ?? row.team_id) as string,
    project_id: (row.projectId ?? row.project_id) as string | null,
    created_by: (row.createdBy ?? row.created_by ?? '') as string,
    title: (row.title ?? '') as string,
    overview: (row.overview ?? null) as string | null,
    content: (row.content ?? null) as string | null,
    goals: (row.goals ?? []) as PRDDocument['goals'],
    user_stories: (row.userStories ?? row.user_stories ?? []) as PRDDocument['user_stories'],
    requirements: (row.requirements ?? []) as PRDDocument['requirements'],
    timeline: (row.timeline ?? null) as string | null,
    status: (row.status ?? 'draft') as PRDDocument['status'],
    version: (row.version ?? 1) as number,
    created_at: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updatedAt ?? row.updated_at ?? new Date().toISOString()),
    ...(row.project != null && { project: row.project as { id: string; name: string } }),
  };
}

export const prdService = {
  async getPRDs(teamId: string): Promise<PRDWithRelations[]> {
    const res = await apiClient.get<Record<string, unknown>[]>(`/${teamId}/prd`);
    if (res.error) throw new Error(res.error);
    return (res.data ?? []).map(normalizePrdRow);
  },

  async getPRD(teamId: string, prdId: string): Promise<PRDWithRelations | null> {
    const res = await apiClient.get<Record<string, unknown>>(`/${teamId}/prd/${prdId}`);
    if (res.error) throw new Error(res.error);
    if (!res.data) return null;
    return normalizePrdRow(res.data);
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
    return normalizePrdRow(res.data as Record<string, unknown>) as PRDDocument;
  },

  async updatePRD(teamId: string, prdId: string, updates: Partial<PRDDocument>): Promise<PRDDocument> {
    console.log('[prdService] Updating PRD:', prdId, updates);
    const res = await apiClient.put<Record<string, unknown>>(`/${teamId}/prd/${prdId}`, updates);
    if (res.error) {
      console.error('[prdService] Update failed:', res.error);
      throw new Error(res.error);
    }
    console.log('[prdService] Update success:', res.data);
    return normalizePrdRow(res.data ?? {}) as PRDDocument;
  },

  async deletePRD(teamId: string, prdId: string): Promise<void> {
    const res = await apiClient.delete<void>(`/${teamId}/prd/${prdId}`);
    if (res.error) throw new Error(res.error);
  },

  async updateStatus(teamId: string, prdId: string, status: PRDStatus): Promise<PRDDocument> {
    return this.updatePRD(teamId, prdId, { status });
  },

  // PRD-Project linking functions (many-to-many)
  async linkToProject(teamId: string, prdId: string, projectId: string): Promise<void> {
    const res = await apiClient.post<void>(`/${teamId}/prd/${prdId}/projects`, {
      projectId,
    });
    if (res.error && !res.error.includes('duplicate')) {
      throw new Error(res.error);
    }
  },

  async unlinkFromProject(teamId: string, prdId: string, projectId: string): Promise<void> {
    const res = await apiClient.delete<void>(`/${teamId}/prd/${prdId}/projects/${projectId}`);
    if (res.error) throw new Error(res.error);
  },

  async getLinkedProjects(teamId: string, prdId: string): Promise<Array<{ id: string; name: string; icon?: string }>> {
    const res = await apiClient.get<Array<{ id: string; name: string; icon?: string }>>(`/${teamId}/prd/${prdId}/projects`);
    if (res.error) throw new Error(res.error);
    return res.data ?? [];
  },

  async getPRDsForProject(projectId: string): Promise<PRDWithRelations[]> {
    const res = await apiClient.get<Record<string, unknown>[]>(`/projects/${projectId}/prd`);
    if (res.error) throw new Error(res.error);
    return (res.data ?? []).map(normalizePrdRow);
  },

  async updateProjectLinks(teamId: string, prdId: string, projectIds: string[]): Promise<void> {
    const res = await apiClient.put<void>(`/${teamId}/prd/${prdId}/projects`, {
      projectIds,
    });
    if (res.error) throw new Error(res.error);
  },
};
