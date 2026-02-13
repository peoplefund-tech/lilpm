import { useState, useEffect, useCallback } from 'react';
import { userAISettingsService } from '@/lib/services/conversationService';
import { useAuthStore } from '@/stores/authStore';
import type { UserAISettings } from '@/types/database';

interface AISettings {
    anthropic_api_key?: string;
    openai_api_key?: string;
    gemini_api_key?: string;
    default_provider: 'anthropic' | 'openai' | 'gemini' | 'auto';
    auto_mode_enabled: boolean;
}

interface UseAISettingsReturn {
    settings: AISettings | null;
    isLoading: boolean;
    hasAnyApiKey: boolean;
    saveApiKey: (provider: 'anthropic' | 'openai' | 'gemini', key: string) => Promise<void>;
    loadSettings: () => Promise<void>;
}

export function useAISettings(): UseAISettingsReturn {
    const { user } = useAuthStore();
    const [settings, setSettings] = useState<AISettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadSettings = useCallback(async () => {
        if (!user) {
            setSettings(null);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const data = await userAISettingsService.getSettings();

            if (data) {
                console.log('[useAISettings] Loaded settings from API:', {
                    hasAnthropicKey: !!data.anthropic_api_key,
                    hasOpenAIKey: !!data.openai_api_key,
                    hasGeminiKey: !!data.gemini_api_key,
                });
                setSettings({
                    anthropic_api_key: data.anthropic_api_key || undefined,
                    openai_api_key: data.openai_api_key || undefined,
                    gemini_api_key: data.gemini_api_key || undefined,
                    default_provider: data.default_provider || 'auto',
                    auto_mode_enabled: data.auto_mode_enabled ?? true,
                });
            } else {
                setSettings({
                    default_provider: 'auto',
                    auto_mode_enabled: true,
                });
            }
        } catch (err) {
            console.error('Failed to load AI settings:', err);
            setSettings({
                default_provider: 'auto',
                auto_mode_enabled: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const saveApiKey = useCallback(async (
        provider: 'anthropic' | 'openai' | 'gemini',
        key: string
    ) => {
        if (!user) return;

        try {
            // Build update object based on provider
            const updateData: {
                anthropic_api_key?: string;
                openai_api_key?: string;
                gemini_api_key?: string;
            } = {};

            if (provider === 'anthropic') {
                updateData.anthropic_api_key = key || undefined;
            } else if (provider === 'openai') {
                updateData.openai_api_key = key || undefined;
            } else if (provider === 'gemini') {
                updateData.gemini_api_key = key || undefined;
            }

            await userAISettingsService.upsertSettings(updateData);

            // Reload settings
            await loadSettings();
        } catch (err) {
            console.error('Failed to save API key:', err);
            throw err;
        }
    }, [user, loadSettings]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const hasAnyApiKey = Boolean(
        settings?.anthropic_api_key ||
        settings?.openai_api_key ||
        settings?.gemini_api_key
    );

    return {
        settings,
        isLoading,
        hasAnyApiKey,
        saveApiKey,
        loadSettings,
    };
}
