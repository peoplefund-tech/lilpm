import { apiClient } from '@/lib/api/client';

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
        const res = await apiClient.get<PRDVersionWithCreator[]>(`/prd/${prdId}/versions`);
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },

    /**
     * Get a specific version by ID
     */
    async getVersion(versionId: string): Promise<PRDVersionWithCreator | null> {
        const res = await apiClient.get<PRDVersionWithCreator>(`/prd/versions/${versionId}`);
        if (res.error) throw new Error(res.error);
        return res.data || null;
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
        const res = await apiClient.post<PRDVersion>(`/prd/${prdId}/versions`, {
            content,
            title,
            description: changeSummary,
        });
        if (res.error) throw new Error(res.error);
        return res.data;
    },

    /**
     * Restore PRD to a specific version
     */
    async restoreVersion(prdId: string, versionId: string): Promise<void> {
        // Get the version content
        const version = await this.getVersion(versionId);
        if (!version) throw new Error('Version not found');

        // Update the PRD with version content
        const updateRes = await apiClient.put(`/prd/${prdId}`, {
            content: version.content,
            title: version.title,
        });
        if (updateRes.error) throw new Error(updateRes.error);

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
        const res = await apiClient.get<PRDVersionWithCreator[]>(`/prd/${prdId}/versions`);
        if (res.error) throw new Error(res.error);
        const versions = res.data || [];
        if (versions.length === 0) return 0;
        return versions[0].version_number || 0;
    },
};
