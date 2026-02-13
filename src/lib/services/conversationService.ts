import { apiClient } from '@/lib/api/client';
import type {
  Conversation,
  Message,
  AIProvider,
  UserAISettings
} from '@/types/database';

// Extended type
export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

// ============================================
// CONVERSATION SERVICES
// ============================================

export const conversationService = {
  /**
   * Get conversations - either personal or shared within a team
   * @param teamId - If provided, gets all team conversations (shared)
   * @param personalOnly - If true, only get user's own conversations
   */
  async getConversations(teamId?: string, personalOnly = false): Promise<Conversation[]> {
    if (teamId) {
      // Get team conversations
      const res = await apiClient.get<Conversation[]>(`/${teamId}/conversations`);
      if (res.error) throw new Error(res.error);

      if (personalOnly) {
        // Filter to personal conversations only (handled on server side, but filter here for safety)
        const currentUserId = await this._getCurrentUserId();
        return (res.data || []).filter(c => c.user_id === currentUserId);
      }

      return res.data || [];
    } else {
      // No team = personal conversations only
      // Use a generic personal endpoint
      const res = await apiClient.get<Conversation[]>('/conversations');
      if (res.error) throw new Error(res.error);
      return res.data || [];
    }
  },

  /**
   * Get all team conversations for collaboration
   */
  async getTeamConversations(teamId: string): Promise<Conversation[]> {
    const res = await apiClient.get<Conversation[]>(`/${teamId}/conversations`);
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  async getConversation(conversationId: string): Promise<ConversationWithMessages | null> {
    const res = await apiClient.get<Conversation>(`/conversations/${conversationId}`);
    if (res.error) throw new Error(res.error);

    if (!res.data) return null;

    // Get messages for this conversation
    const messagesRes = await apiClient.get<Message[]>(`/conversations/${conversationId}/messages`);
    if (messagesRes.error) throw new Error(messagesRes.error);

    const messages = messagesRes.data || [];

    // Sort messages by created_at
    messages.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return {
      ...res.data,
      messages,
    } as ConversationWithMessages;
  },

  async createConversation(
    teamId?: string,
    projectId?: string,
    title?: string,
    aiProvider: AIProvider = 'anthropic'
  ): Promise<Conversation> {
    const endpoint = teamId ? `/${teamId}/conversations` : '/conversations';

    const res = await apiClient.post<Conversation>(endpoint, {
      projectId,
      title,
      aiProvider,
    });

    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error('Failed to create conversation');

    return res.data;
  },

  async updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<Conversation> {
    const res = await apiClient.put<Conversation>(`/conversations/${conversationId}`, updates);

    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error('Failed to update conversation');

    return res.data;
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const res = await apiClient.delete<void>(`/conversations/${conversationId}`);

    if (res.error) throw new Error(res.error);
  },

  // Helper to get current user ID from token
  async _getCurrentUserId(): Promise<string> {
    // Get from API or token - this is handled by the server via JWT
    // For now, we'll need to fetch the current user from a profile endpoint
    // This is a workaround - ideally the server would provide this
    const token = apiClient.getAccessToken();
    if (!token) throw new Error('Not authenticated');

    // Decode JWT to get user ID
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.sub;
    } catch {
      throw new Error('Invalid token');
    }
  },
};

// ============================================
// MESSAGE SERVICES
// ============================================

export const messageService = {
  async getMessages(conversationId: string): Promise<Message[]> {
    const res = await apiClient.get<Message[]>(`/conversations/${conversationId}/messages`);
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  async createMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, unknown>,
    aiProvider?: AIProvider,
    tokensUsed?: number
  ): Promise<Message> {
    const res = await apiClient.post<Message>(`/conversations/${conversationId}/messages`, {
      role,
      content,
      metadata: metadata || {},
      aiProvider,
      tokensUsed,
    });

    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error('Failed to create message');

    return res.data;
  },

  async getConversationContext(conversationId: string, limit = 20): Promise<Message[]> {
    const res = await apiClient.get<Message[]>(`/conversations/${conversationId}/messages?limit=${limit}&context=true`);
    if (res.error) throw new Error(res.error);

    const messages = res.data || [];
    return messages.reverse(); // Reverse to get chronological order
  },
};

// ============================================
// USER AI SETTINGS SERVICES
// ============================================

export const userAISettingsService = {
  async getSettings(): Promise<UserAISettings | null> {
    const res = await apiClient.get<UserAISettings>('/users/ai-settings/me');
    if (res.error) throw new Error(res.error);
    return res.data || null;
  },

  async upsertSettings(settings: {
    anthropic_api_key?: string;
    openai_api_key?: string;
    gemini_api_key?: string;
    default_provider?: AIProvider;
    auto_mode_enabled?: boolean;
  }): Promise<UserAISettings> {
    // Convert snake_case to camelCase for API
    const res = await apiClient.put<UserAISettings>('/users/ai-settings/me', {
      anthropicApiKey: settings.anthropic_api_key,
      openaiApiKey: settings.openai_api_key,
      geminiApiKey: settings.gemini_api_key,
      defaultProvider: settings.default_provider,
      autoModeEnabled: settings.auto_mode_enabled,
    });

    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error('Failed to update AI settings');

    return res.data;
  },

  async getAvailableProviders(): Promise<AIProvider[]> {
    const settings = await this.getSettings();
    if (!settings) return [];

    const providers: AIProvider[] = [];
    if (settings.anthropic_api_key) providers.push('anthropic');
    if (settings.openai_api_key) providers.push('openai');
    if (settings.gemini_api_key) providers.push('gemini');

    if (providers.length > 1 && settings.auto_mode_enabled) {
      providers.push('auto');
    }

    return providers;
  },
};
