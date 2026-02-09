import { supabase } from '@/lib/supabase';

export interface PRDVersion {
    id: string;
    prd_id: string;
    content: string | null;
    title: string;
    version_number: number;
    created_by: string | null;
    created_at: string;
    change_summary: string | null;
}

export interface PRDVersionWithCreator extends PRDVersion {
    creator?: {
        id: string;
        name: string | null;
        email: string | null;
        avatar_url: string | null;
    } | null;
}

export const prdVersionService = {
    /**
     * Get all versions for a PRD (newest first)
     */
    async getVersions(prdId: string): Promise<PRDVersionWithCreator[]> {
        const { data, error } = await supabase
            .from('prd_versions')
            .select(`
        *,
        creator:profiles(id, name, email, avatar_url)
      `)
            .eq('prd_id', prdId)
            .order('version_number', { ascending: false });

        if (error) throw error;
        return (data || []) as unknown as PRDVersionWithCreator[];
    },

    /**
     * Get a specific version by ID
     */
    async getVersion(versionId: string): Promise<PRDVersionWithCreator | null> {
        const { data, error } = await supabase
            .from('prd_versions')
            .select(`
        *,
        creator:profiles(id, name, email, avatar_url)
      `)
            .eq('id', versionId)
            .single();

        if (error) throw error;
        return data as unknown as PRDVersionWithCreator;
    },

    /**
     * Create a new version
     */
    async createVersion(
        prdId: string,
        content: string,
        title: string,
        changeSummary?: string
    ): Promise<PRDVersion> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Get next version number
        const { data: latestVersion } = await supabase
            .from('prd_versions')
            .select('version_number')
            .eq('prd_id', prdId)
            .order('version_number', { ascending: false })
            .limit(1)
            .single();

        const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

        const { data, error } = await supabase
            .from('prd_versions')
            .insert({
                prd_id: prdId,
                content,
                title,
                version_number: nextVersionNumber,
                created_by: user.id,
                change_summary: changeSummary || `Version ${nextVersionNumber}`,
            })
            .select()
            .single();

        if (error) throw error;
        return data as PRDVersion;
    },

    /**
     * Restore PRD to a specific version
     */
    async restoreVersion(prdId: string, versionId: string): Promise<void> {
        // Get the version content
        const version = await this.getVersion(versionId);
        if (!version) throw new Error('Version not found');

        // Update the PRD with version content
        const { error: updateError } = await supabase
            .from('prd_documents')
            .update({
                content: version.content,
                title: version.title,
                updated_at: new Date().toISOString(),
            })
            .eq('id', prdId);

        if (updateError) throw updateError;

        // Create a new version noting the restore
        await this.createVersion(
            prdId,
            version.content || '',
            version.title,
            `Restored from version ${version.version_number}`
        );
    },

    /**
     * Get the latest version number for a PRD
     */
    async getLatestVersionNumber(prdId: string): Promise<number> {
        const { data } = await supabase
            .from('prd_versions')
            .select('version_number')
            .eq('prd_id', prdId)
            .order('version_number', { ascending: false })
            .limit(1)
            .single();

        return data?.version_number || 0;
    },
};
