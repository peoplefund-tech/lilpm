import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

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
            const { data, error } = await supabase
                .from('user_ai_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            // PGRST116 = single row not found, 406 = schema mismatch (API issue)
            // Both are non-critical errors - app works without settings
            if (error && error.code !== 'PGRST116' && !String(error.message || '').includes('406')) {
                console.error('Error loading AI settings:', error);
            }

            if (data) {
                console.log('[useAISettings] Loaded settings from user_ai_settings:', {
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

        const keyField = `${provider}_api_key`;
        const updateData: Record<string, unknown> = {
            [keyField]: key || null,
            updated_at: new Date().toISOString(),
        };

        // Check if settings exist
        const { data: existing } = await supabase
            .from('user_ai_settings')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (existing) {
            await supabase
                .from('user_ai_settings')
                .update(updateData)
                .eq('user_id', user.id);
        } else {
            await supabase
                .from('user_ai_settings')
                .insert({
                    user_id: user.id,
                    ...updateData,
                    default_provider: 'auto',
                    auto_mode_enabled: true,
                });
        }

        // Reload settings
        await loadSettings();
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
