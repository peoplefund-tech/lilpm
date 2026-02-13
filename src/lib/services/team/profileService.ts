import { apiClient } from '@/lib/api/client';
import type { Profile } from '@/types/database';

// ============================================
// PROFILE SERVICES
// ============================================

export const profileService = {
    async getProfile(userId: string): Promise<Profile | null> {
        const res = await apiClient.get<Profile>(`/users/${userId}`);
        if (res.error) throw new Error(res.error);
        return res.data || null;
    },

    async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
        // Map camelCase to snake_case for API
        const apiUpdates: Record<string, any> = {};
        if (updates.name !== undefined) apiUpdates.name = updates.name;
        if (updates.avatar_url !== undefined) apiUpdates.avatarUrl = updates.avatar_url;
        if (updates.timezone !== undefined) apiUpdates.timezone = updates.timezone;
        if (updates.preferred_ai_provider !== undefined) apiUpdates.preferredAiProvider = updates.preferred_ai_provider;
        if (updates.onboarding_completed !== undefined) apiUpdates.onboardingCompleted = updates.onboarding_completed;

        const res = await apiClient.put<Profile>(`/users/${userId}`, apiUpdates);
        if (res.error) throw new Error(res.error);
        return res.data;
    },
};
