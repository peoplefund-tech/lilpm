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
    async getVersions(teamId: string, prdId: string): Promise<PRDVersionWithCreator[]> {
        const res = await apiClient.get<PRDVersionWithCreator[]>(`/${teamId}/prd/${prdId}/versions`);
        if (res.error) throw new Error(res.error);
        return res.data || [];
    },

    /**
     * Get a specific version by ID (uses first version's prdDocumentId for route; server may not have dedicated endpoint)
     */
    async getVersion(_teamId: string, versionId: string): Promise<PRDVersionWithCreator | null> {
        const res = await apiClient.get<PRDVersionWithCreator>(`/prd/versions/${versionId}`);
        if (res.error) throw new Error(res.error);
        return res.data || null;
    },

    /**
     * Create a new version
     */
    async createVersion(
        teamId: string,
        prdId: string,
        content: string,
        title: string,
        changeSummary?: string
    ): Promise<PRDVersion> {
        const res = await apiClient.post<PRDVersion>(`/${teamId}/prd/${prdId}/versions`, {
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
    async restoreVersion(teamId: string, prdId: string, versionId: string): Promise<void> {
        const version = await this.getVersion(teamId, versionId);
        if (!version) throw new Error('Version not found');

        const updateRes = await apiClient.put(`/${teamId}/prd/${prdId}`, {
            content: version.content,
            title: version.title,
        });
        if (updateRes.error) throw new Error(updateRes.error);

        await this.createVersion(
            teamId,
            prdId,
            version.content || '',
            version.title,
            `Restored from version ${version.version_number}`
        );
    },

    /**
     * Get the latest version number for a PRD
     */
    async getLatestVersionNumber(teamId: string, prdId: string): Promise<number> {
        const res = await apiClient.get<PRDVersionWithCreator[]>(`/${teamId}/prd/${prdId}/versions`);
        if (res.error) throw new Error(res.error);
        const versions = res.data || [];
        if (versions.length === 0) return 0;
        return versions[0].version_number || 0;
    },
};
