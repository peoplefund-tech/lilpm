// AI Assistant logic for PRD Detail Page
import { useState, useEffect, useCallback, useRef } from 'react';
import type { AIProvider } from '@/types';
import type { PRDWithRelations } from '@/features/prd';
import { userAISettingsService } from '@/lib/services/conversationService';
import type { AIMessage, AISuggestion } from '@/features/prd/types/PRDTypes';

export interface UsePRDAIAssistantProps {
    prd: PRDWithRelations | null;
    content: string;
    userId?: string;
    onContentChange: (content: string) => void;
    addToHistory: (content: string, description: string) => void;
}

export interface UsePRDAIAssistantReturn {
    showAIPanel: boolean;
    aiMessages: AIMessage[];
    aiInput: string;
    isAILoading: boolean;
    selectedProvider: AIProvider;
    availableProviders: AIProvider[];
    providerLabels: Record<AIProvider, string>;
    pendingSuggestion: AISuggestion | null;
    aiMessagesEndRef: React.RefObject<HTMLDivElement>;

    setShowAIPanel: (show: boolean) => void;
    setAiInput: (input: string) => void;
    setSelectedProvider: (provider: AIProvider) => void;
    handleAISend: () => Promise<void>;
    handleAcceptSuggestion: (suggestion: AISuggestion) => void;
    handleRejectSuggestion: (suggestion: AISuggestion) => void;
}

export function usePRDAIAssistant({
    prd,
    content,
    userId,
    onContentChange,
    addToHistory,
}: UsePRDAIAssistantProps): UsePRDAIAssistantReturn {
    const [showAIPanel, setShowAIPanel] = useState(false);
    const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
    const [aiInput, setAiInput] = useState('');
    const [isAILoading, setIsAILoading] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>('anthropic');
    const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([]);
    const [pendingSuggestion, setPendingSuggestion] = useState<AISuggestion | null>(null);
    const aiMessagesEndRef = useRef<HTMLDivElement>(null);

    const providerLabels: Record<AIProvider, string> = {
        auto: '✨ Auto',
        anthropic: '🟣 Claude',
        openai: '🟢 GPT-4o',
        gemini: '🔵 Gemini',
    };

    // Fetch available AI providers on mount
    useEffect(() => {
        async function fetchProviders() {
            if (userId) {
                try {
                    const providers = await userAISettingsService.getAvailableProviders();
                    setAvailableProviders(providers.length > 0 ? providers : ['anthropic']);
                    const settings = await userAISettingsService.getSettings();
                    if (settings?.default_provider && providers.includes(settings.default_provider)) {
                        setSelectedProvider(settings.default_provider);
                    } else if (providers.length > 0) {
                        setSelectedProvider(providers[0]);
                    }
                } catch (error) {
                    console.error('Failed to fetch AI providers:', error);
                    setAvailableProviders(['anthropic']);
                }
            }
        }
        fetchProviders();
    }, [userId]);

    // Scroll AI messages to bottom
    useEffect(() => {
        aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [aiMessages]);

    const handleAISend = useCallback(async () => {
        if (!aiInput.trim() || isAILoading) return;

        const userMessage: AIMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: aiInput.trim(),
            timestamp: new Date(),
        };
        setAiMessages(prev => [...prev, userMessage]);
        const userQuery = aiInput.trim();
        setAiInput('');
        setIsAILoading(true);

        const assistantMessageId = (Date.now() + 1).toString();
        setAiMessages(prev => [...prev, {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
        }]);

        try {
            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lbzjnhlribtfwnoydpdv.supabase.co';
            const response = await fetch(`${SUPABASE_URL}/functions/v1/lily-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: `You are a PRD editing assistant. The user wants to modify their PRD document.
              
Current PRD content (HTML format):
${content}

When the user asks for changes, respond with a JSON block like this:
[PRD_EDIT]
{
  "description": "Brief description of the change",
  "newContent": "<full HTML content of the modified PRD>"
}
[/PRD_EDIT]

Always preserve the HTML structure and formatting. Make the requested changes while keeping the rest intact.
If the user asks a question, answer it helpfully without the PRD_EDIT block.
Respond in the same language as the user's message.`
                        },
                        ...aiMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: userQuery }
                    ],
                    provider: selectedProvider,
                    stream: true,
                }),
            });

            if (!response.ok) throw new Error(`API error: ${response.status}`);

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(data);
                                const delta = parsed.choices?.[0]?.delta?.content ||
                                    parsed.delta?.text ||
                                    parsed.content ||
                                    parsed.text || '';
                                if (delta) {
                                    fullContent += delta;
                                    setAiMessages(prev => prev.map(m =>
                                        m.id === assistantMessageId ? { ...m, content: fullContent } : m
                                    ));
                                }
                            } catch {
                                if (line.trim() && !line.startsWith(':')) {
                                    fullContent += data;
                                    setAiMessages(prev => prev.map(m =>
                                        m.id === assistantMessageId ? { ...m, content: fullContent } : m
                                    ));
                                }
                            }
                        }
                    }
                }
            }

            // Parse PRD edit suggestion
            const editMatch = fullContent.match(/\[PRD_EDIT\]([\s\S]*?)\[\/PRD_EDIT\]/);
            let suggestion: AISuggestion | undefined;
            let cleanContent = fullContent;

            if (editMatch) {
                try {
                    const editData = JSON.parse(editMatch[1]);
                    suggestion = {
                        id: Date.now().toString(),
                        originalContent: content,
                        suggestedContent: editData.newContent,
                        description: editData.description,
                        status: 'pending',
                    };
                    setPendingSuggestion(suggestion);
                    cleanContent = fullContent.replace(/\[PRD_EDIT\][\s\S]*?\[\/PRD_EDIT\]/, '').trim();
                    cleanContent = cleanContent || `I suggest the following change: ${editData.description}`;
                } catch (e) {
                    console.error('Failed to parse PRD edit:', e);
                }
            }

            setAiMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, content: cleanContent, suggestion } : m
            ));
        } catch (error) {
            console.error('AI request failed:', error);
            setAiMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? {
                    ...m,
                    content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                } : m
            ));
        } finally {
            setIsAILoading(false);
        }
    }, [aiInput, isAILoading, content, aiMessages, selectedProvider]);

    const handleAcceptSuggestion = useCallback((suggestion: AISuggestion) => {
        addToHistory(content, 'Before AI edit');
        onContentChange(suggestion.suggestedContent);
        setPendingSuggestion(null);

        setAiMessages(prev => prev.map(m =>
            m.suggestion?.id === suggestion.id
                ? { ...m, suggestion: { ...m.suggestion, status: 'accepted' as const } }
                : m
        ));
    }, [content, addToHistory, onContentChange]);

    const handleRejectSuggestion = useCallback((suggestion: AISuggestion) => {
        setPendingSuggestion(null);
        setAiMessages(prev => prev.map(m =>
            m.suggestion?.id === suggestion.id
                ? { ...m, suggestion: { ...m.suggestion, status: 'rejected' as const } }
                : m
        ));
    }, []);

    return {
        showAIPanel,
        aiMessages,
        aiInput,
        isAILoading,
        selectedProvider,
        availableProviders,
        providerLabels,
        pendingSuggestion,
        aiMessagesEndRef,
        setShowAIPanel,
        setAiInput,
        setSelectedProvider,
        handleAISend,
        handleAcceptSuggestion,
        handleRejectSuggestion,
    };
}
