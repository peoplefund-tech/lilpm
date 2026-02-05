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
};
