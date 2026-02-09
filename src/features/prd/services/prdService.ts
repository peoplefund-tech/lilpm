import { supabase } from '@/lib/supabase';
import type { PRDDocument } from '@/types/database';

export type PRDStatus = 'draft' | 'review' | 'approved' | 'archived';

export interface PRDWithRelations extends PRDDocument {
  project?: { id: string; name: string } | null;
}

export const prdService = {
  async getPRDs(teamId: string): Promise<PRDWithRelations[]> {
    const { data, error } = await supabase
      .from('prd_documents')
      .select(`
        *,
        project:projects(id, name)
      `)
      .eq('team_id', teamId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as PRDWithRelations[];
  },

  async getPRD(prdId: string): Promise<PRDWithRelations | null> {
    const { data, error } = await supabase
      .from('prd_documents')
      .select(`
        *,
        project:projects(id, name)
      `)
      .eq('id', prdId)
      .single();

    if (error) throw error;
    return data as unknown as PRDWithRelations;
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: prd, error } = await supabase
      .from('prd_documents')
      .insert({
        team_id: teamId,
        created_by: user.id,
        title: data.title,
        overview: data.overview,
        goals: data.goals || [],
        user_stories: data.user_stories || [],
        requirements: data.requirements || [],
        timeline: data.timeline,
        project_id: data.project_id,
        conversation_id: data.conversation_id,
        status: 'draft',
      } as any)
      .select()
      .single();

    if (error) throw error;
    return prd as PRDDocument;
  },

  async updatePRD(prdId: string, updates: Partial<PRDDocument>): Promise<PRDDocument> {
    console.log('[prdService] Updating PRD:', prdId, updates);
    const { data, error } = await supabase
      .from('prd_documents')
      .update(updates as any)
      .eq('id', prdId)
      .select()
      .single();

    if (error) {
      console.error('[prdService] Update failed:', error);
      throw error;
    }
    console.log('[prdService] Update success:', data);
    return data as PRDDocument;
  },

  async deletePRD(prdId: string): Promise<void> {
    const { error } = await supabase
      .from('prd_documents')
      .delete()
      .eq('id', prdId);

    if (error) throw error;
  },

  async updateStatus(prdId: string, status: PRDStatus): Promise<PRDDocument> {
    return this.updatePRD(prdId, { status });
  },

  // PRD-Project linking functions (many-to-many)
  async linkToProject(prdId: string, projectId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('prd_projects')
      .insert({
        prd_id: prdId,
        project_id: projectId,
        created_by: user?.id,
      });

    if (error && !error.message.includes('duplicate')) {
      throw error;
    }
  },

  async unlinkFromProject(prdId: string, projectId: string): Promise<void> {
    const { error } = await supabase
      .from('prd_projects')
      .delete()
      .eq('prd_id', prdId)
      .eq('project_id', projectId);

    if (error) throw error;
  },

  async getLinkedProjects(prdId: string): Promise<Array<{ id: string; name: string; icon?: string }>> {
    const { data, error } = await supabase
      .from('prd_projects')
      .select(`
        project:projects(id, name, icon)
      `)
      .eq('prd_id', prdId);

    if (error) throw error;
    return (data || []).map((d: any) => d.project).filter(Boolean);
  },

  async getPRDsForProject(projectId: string): Promise<PRDWithRelations[]> {
    const { data, error } = await supabase
      .from('prd_projects')
      .select(`
        prd:prd_documents(*)
      `)
      .eq('project_id', projectId);

    if (error) throw error;
    return (data || []).map((d: any) => d.prd).filter(Boolean);
  },

  async updateProjectLinks(prdId: string, projectIds: string[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    // Get current links
    const { data: currentLinks } = await supabase
      .from('prd_projects')
      .select('project_id')
      .eq('prd_id', prdId);

    const currentProjectIds = (currentLinks || []).map((l: any) => l.project_id);

    // Find links to remove and add
    const toRemove = currentProjectIds.filter((id: string) => !projectIds.includes(id));
    const toAdd = projectIds.filter((id: string) => !currentProjectIds.includes(id));

    // Remove old links
    if (toRemove.length > 0) {
      await supabase
        .from('prd_projects')
        .delete()
        .eq('prd_id', prdId)
        .in('project_id', toRemove);
    }

    // Add new links
    if (toAdd.length > 0) {
      await supabase
        .from('prd_projects')
        .insert(
          toAdd.map((projectId: string) => ({
            prd_id: prdId,
            project_id: projectId,
            created_by: user?.id,
          }))
        );
    }
  },
};
