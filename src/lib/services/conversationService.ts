import { supabase } from '@/lib/supabase';
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (teamId) {
      query = query.eq('team_id', teamId);
      // If not personal only, show all team conversations (shared)
      if (personalOnly) {
        query = query.eq('user_id', user.id);
      }
    } else {
      // No team = personal conversations only
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return (data || []) as Conversation[];
  },

  /**
   * Get all team conversations for collaboration
   */
  async getTeamConversations(teamId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('team_id', teamId)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as Conversation[];
  },

  async getConversation(conversationId: string): Promise<ConversationWithMessages | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages(*)
      `)
      .eq('id', conversationId)
      .single();
    
    if (error) throw error;
    if (!data) return null;
    
    // Sort messages by created_at
    const typedData = data as unknown as ConversationWithMessages;
    if (typedData.messages) {
      typedData.messages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    
    return typedData;
  },

  async createConversation(
    teamId?: string,
    projectId?: string,
    title?: string,
    aiProvider: AIProvider = 'anthropic'
  ): Promise<Conversation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        team_id: teamId,
        project_id: projectId,
        title,
        ai_provider: aiProvider,
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return data as Conversation;
  },

  async updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<Conversation> {
    const { data, error } = await supabase
      .from('conversations')
      .update(updates as any)
      .eq('id', conversationId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Conversation;
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);
    
    if (error) throw error;
  },
};

// ============================================
// MESSAGE SERVICES
// ============================================

export const messageService = {
  async getMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return (data || []) as Message[];
  },

  async createMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, unknown>,
    aiProvider?: AIProvider,
    tokensUsed?: number
  ): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        metadata: metadata || {},
        ai_provider: aiProvider,
        tokens_used: tokensUsed,
      } as any)
      .select()
      .single();
    
    if (error) throw error;

    // Update conversation's updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() } as any)
      .eq('id', conversationId);

    return data as Message;
  },

  async getConversationContext(conversationId: string, limit = 20): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return ((data || []) as Message[]).reverse(); // Reverse to get chronological order
  },
};

// ============================================
// USER AI SETTINGS SERVICES
// ============================================

export const userAISettingsService = {
  async getSettings(): Promise<UserAISettings | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('user_ai_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as UserAISettings | null;
  },

  async upsertSettings(settings: {
    anthropic_api_key?: string;
    openai_api_key?: string;
    gemini_api_key?: string;
    default_provider?: AIProvider;
    auto_mode_enabled?: boolean;
  }): Promise<UserAISettings> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('user_ai_settings')
      .upsert({
        user_id: user.id,
        ...settings,
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return data as UserAISettings;
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
