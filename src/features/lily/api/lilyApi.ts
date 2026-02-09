import type { LilyMessage, PRDDocument, Issue } from '@/types';
import { lilyClient } from './client';

// Lily MCP API
export const lilyApi = {
    sendMessage: (message: string, context?: { teamId?: string; projectId?: string }) =>
        lilyClient.post<LilyMessage>('/chat', { message, context }),

    getHistory: (conversationId: string) =>
        lilyClient.get<LilyMessage[]>(`/conversations/${conversationId}/messages`),

    generatePRD: (conversationId: string) =>
        lilyClient.post<PRDDocument>(`/conversations/${conversationId}/generate-prd`),

    generateTickets: (prdId: string, teamId: string) =>
        lilyClient.post<Issue[]>(`/prd/${prdId}/generate-tickets`, { teamId }),

    getDataSources: () =>
        lilyClient.get<{ id: string; name: string; type: string }[]>('/data-sources'),

    queryDataSource: (sourceId: string, query: string) =>
        lilyClient.post<unknown>(`/data-sources/${sourceId}/query`, { query }),
};
