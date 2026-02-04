import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { conversationService, messageService } from '@/lib/services/conversationService';
import type { LilyMessage, PRDDocument, Issue, AIProvider } from '@/types';

// Fallback to hardcoded URL if env var is undefined
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lbzjnhlribtfwnoydpdv.supabase.co';
const CHAT_URL = `${SUPABASE_URL}/functions/v1/lily-chat`;

interface LilyStore {
  messages: LilyMessage[];
  isLoading: boolean;
  currentConversationId: string | null;
  conversations: { id: string; title: string | null; updatedAt: string }[];
  suggestedPRD: PRDDocument | null;
  suggestedIssues: Partial<Issue>[];
  dataSources: { id: string; name: string; type: string }[];
  selectedProvider: AIProvider;
  abortController: AbortController | null;
  
  // Actions
  sendMessage: (message: string, context?: { teamId?: string; projectId?: string }) => Promise<void>;
  stopGeneration: () => void;
  loadConversations: (teamId?: string) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  createConversation: (teamId?: string, projectId?: string) => Promise<string>;
  deleteConversation: (conversationId: string) => Promise<void>;
  loadDataSources: () => Promise<void>;
  generatePRD: () => Promise<void>;
  generateTickets: (teamId: string) => Promise<Issue[]>;
  analyzeProject: (teamId: string) => Promise<void>;
  clearChat: () => void;
  acceptSuggestedIssue: (index: number) => void;
  rejectSuggestedIssue: (index: number) => void;
  setProvider: (provider: AIProvider) => void;
}

// Parse issue suggestions from AI response with enhanced format support
function parseIssueSuggestions(content: string): Partial<Issue>[] {
  const issues: Partial<Issue>[] = [];
  const regex = /\[ISSUE_SUGGESTION\]([\s\S]*?)\[\/ISSUE_SUGGESTION\]/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const block = match[1];
    
    // Parse title
    const title = block.match(/- title:\s*(.+)/)?.[1]?.trim();
    
    // Parse type (new field)
    const typeMatch = block.match(/- type:\s*(\w+)/)?.[1]?.trim();
    const type = typeMatch as Issue['type'] || 'task';
    
    // Parse multiline description (supports | for multiline)
    let description = '';
    const descMatch = block.match(/- description:\s*\|?\s*([\s\S]*?)(?=\n- (?:priority|estimate|acceptance_criteria|type)|$)/);
    if (descMatch) {
      description = descMatch[1].trim();
    } else {
      // Fallback to single line
      description = block.match(/- description:\s*(.+)/)?.[1]?.trim() || '';
    }
    
    // Parse priority
    const priority = block.match(/- priority:\s*(\w+)/)?.[1]?.trim() as Issue['priority'] || 'medium';
    
    // Parse estimate (new field)
    const estimateMatch = block.match(/- estimate:\s*(\d+)/)?.[1];
    const estimate = estimateMatch ? parseInt(estimateMatch, 10) : undefined;
    
    // Parse acceptance criteria (new field for user stories)
    let acceptanceCriteria: string[] | undefined;
    const acMatch = block.match(/- acceptance_criteria:\s*\|?\s*([\s\S]*?)(?=\n- (?!.*\[)|$)/);
    if (acMatch) {
      const acText = acMatch[1].trim();
      acceptanceCriteria = acText
        .split('\n')
        .map(line => line.replace(/^[\s-]*\[[ x]?\]\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    
    if (title) {
      issues.push({ 
        title, 
        description, 
        priority,
        type,
        estimate,
        acceptanceCriteria,
      });
    }
  }
  
  return issues;
}

// Stream chat with AI
async function streamChat({
  messages,
  provider,
  onDelta,
  onDone,
  onError,
  signal,
}: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  provider: AIProvider;
  onDelta: (text: string) => void;
  onDone: (fullContent: string) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}) {
  const { data: { session } } = await supabase.auth.getSession();

  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ messages, provider, stream: true }),
    signal,
  });

  // Handle error responses
  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({ error: 'Unknown error' }));

    const parts: string[] = [];
    parts.push(errorData.error || `Error: ${resp.status}`);
    if (errorData.provider) parts.push(`provider: ${String(errorData.provider)}`);
    if (errorData.version) parts.push(`function: ${String(errorData.version)}`);
    if (errorData.details) parts.push(`details: ${String(errorData.details).slice(0, 300)}`);
    if (errorData.fallback?.details) parts.push(`fallback: ${String(errorData.fallback.details).slice(0, 300)}`);

    onError(parts.join('\n'));
    return;
  }

  // Check if it's a streaming response
  const contentType = resp.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    // Non-streaming response (e.g., Gemini)
    const data = await resp.json();
    if (data.content) {
      onDelta(data.content);
      onDone(data.content);
    } else if (data.error) {
      onError(data.error);
    }
    return;
  }

  // Process SSE stream
  if (!resp.body) {
    onError('No response body');
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = '';
  let fullContent = '';
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        // Handle different response formats
        const content = parsed.choices?.[0]?.delta?.content || 
                       parsed.delta?.text ||
                       parsed.content?.[0]?.text || '';
        if (content) {
          fullContent += content;
          onDelta(content);
        }
      } catch {
        // Incomplete JSON, put back and wait for more
        textBuffer = line + '\n' + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (raw.startsWith(':') || raw.trim() === '') continue;
      if (!raw.startsWith('data: ')) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content || parsed.delta?.text || '';
        if (content) {
          fullContent += content;
          onDelta(content);
        }
      } catch { /* ignore */ }
    }
  }

  onDone(fullContent);
}

export const useLilyStore = create<LilyStore>((set, get) => ({
  messages: [],
  isLoading: false,
  currentConversationId: null,
  conversations: [],
  suggestedPRD: null,
  suggestedIssues: [],
  dataSources: [],
  selectedProvider: 'auto',
  abortController: null,

  stopGeneration: () => {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
      set({ isLoading: false, abortController: null });
    }
  },

  loadConversations: async (teamId?: string) => {
    try {
      const conversations = await conversationService.getConversations(teamId);
      set({ 
        conversations: conversations.map(c => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updated_at,
        })),
      });
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  },

  loadConversation: async (conversationId: string) => {
    try {
      const conversation = await conversationService.getConversation(conversationId);
      if (!conversation) return;

      const messages: LilyMessage[] = conversation.messages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.created_at,
      }));

      set({
        currentConversationId: conversationId,
        messages,
        suggestedIssues: [],
      });
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  },

  createConversation: async (teamId?: string, projectId?: string) => {
    try {
      const conversation = await conversationService.createConversation(
        teamId,
        projectId,
        undefined,
        get().selectedProvider === 'auto' ? 'anthropic' : get().selectedProvider
      );
      
      set((state) => ({
        currentConversationId: conversation.id,
        messages: [],
        conversations: [
          { id: conversation.id, title: conversation.title, updatedAt: conversation.updated_at },
          ...state.conversations,
        ],
      }));
      
      return conversation.id;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  },

  deleteConversation: async (conversationId: string) => {
    try {
      await conversationService.deleteConversation(conversationId);
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== conversationId),
        currentConversationId: state.currentConversationId === conversationId 
          ? null 
          : state.currentConversationId,
        messages: state.currentConversationId === conversationId ? [] : state.messages,
      }));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  },

  sendMessage: async (message: string, context?: { teamId?: string; projectId?: string }) => {
    const userMessage: LilyMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    // Create AbortController for this request
    const abortController = new AbortController();

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      abortController,
    }));

    // Prepare messages for API
    const apiMessages = get().messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    apiMessages.push({ role: 'user', content: message });

    let assistantContent = '';
    
    const updateAssistantMessage = (chunk: string) => {
      assistantContent += chunk;
      set((state) => {
        const lastMsg = state.messages[state.messages.length - 1];
        if (lastMsg?.role === 'assistant') {
          return {
            messages: state.messages.map((m, i) => 
              i === state.messages.length - 1 
                ? { ...m, content: assistantContent }
                : m
            ),
          };
        }
        // Create new assistant message
        return {
          messages: [...state.messages, {
            id: Date.now().toString(),
            role: 'assistant' as const,
            content: assistantContent,
            timestamp: new Date().toISOString(),
          }],
        };
      });
    };

    try {
      await streamChat({
        messages: apiMessages,
        provider: get().selectedProvider,
        signal: abortController.signal,
        onDelta: (chunk) => updateAssistantMessage(chunk),
        onDone: (fullContent) => {
          const issues = parseIssueSuggestions(fullContent);
          set((state) => ({
            isLoading: false,
            abortController: null,
            suggestedIssues: issues.length > 0 ? [...state.suggestedIssues, ...issues] : state.suggestedIssues,
          }));
        },
        onError: (error) => {
          set((state) => ({
            messages: [...state.messages, {
              id: Date.now().toString(),
              role: 'assistant' as const,
              content: `오류가 발생했습니다: ${error}`,
              timestamp: new Date().toISOString(),
            }],
            isLoading: false,
            abortController: null,
          }));
        },
      });
    } catch (error) {
      // Check if it was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        set({ isLoading: false, abortController: null });
        return;
      }
      set((state) => ({
        messages: [...state.messages, {
          id: Date.now().toString(),
          role: 'assistant' as const,
          content: '네트워크 오류가 발생했습니다. 연결을 확인하고 다시 시도해 주세요.',
          timestamp: new Date().toISOString(),
        }],
        isLoading: false,
        abortController: null,
      }));
    }
  },

  loadDataSources: async () => {
    // TODO: Implement when data sources are added
    set({ dataSources: [] });
  },

  generatePRD: async () => {
    const messages = get().messages;
    if (messages.length === 0) return;

    // Create a prompt to generate PRD from conversation
    const prdPrompt = `지금까지의 대화를 바탕으로 PRD(제품 요구사항 문서)를 작성해주세요. 다음 형식으로 작성해주세요:

## 제목
[프로젝트/기능 이름]

## 개요
[프로젝트 개요 설명]

## 목표
- [목표 1]
- [목표 2]
- [목표 3]

## 사용자 스토리
- [사용자 스토리 1]
- [사용자 스토리 2]

## 요구사항
- [기능 요구사항 1]
- [기능 요구사항 2]

## 타임라인
[예상 일정]`;

    await get().sendMessage(prdPrompt);
  },

  generateTickets: async (teamId: string) => {
    const prd = get().suggestedPRD;
    const messages = get().messages;
    
    if (messages.length === 0) return [];

    const ticketPrompt = `지금까지의 대화와 PRD를 바탕으로 개발 이슈/티켓을 생성해주세요. 각 티켓은 다음 형식으로 제안해주세요:

[ISSUE_SUGGESTION]
- title: 이슈 제목
- description: 상세 설명
- priority: urgent/high/medium/low
[/ISSUE_SUGGESTION]

최소 3개 이상의 구체적인 개발 태스크를 제안해주세요.`;

    await get().sendMessage(ticketPrompt);
    
    return [];
  },

  analyzeProject: async (teamId: string) => {
    const analyzePrompt = `Please analyze the current project status. Provide:

1. **Project Overview** - Summary of active issues, sprints, and team velocity
2. **Risk Assessment** - Identify potential blockers or delays
3. **Recommendations** - Suggest improvements for workflow and productivity
4. **Priority Focus** - What should the team focus on this week?

If you can suggest any issues to create, use this format:

[ISSUE_SUGGESTION]
- title: Issue title
- description: Detailed description
- priority: urgent/high/medium/low
[/ISSUE_SUGGESTION]`;

    await get().sendMessage(analyzePrompt, { teamId });
  },

  clearChat: () => {
    set({
      messages: [],
      currentConversationId: null,
      suggestedPRD: null,
      suggestedIssues: [],
    });
  },

  acceptSuggestedIssue: (index: number) => {
    // TODO: Create actual issue in database
    set((state) => ({
      suggestedIssues: state.suggestedIssues.filter((_, i) => i !== index),
    }));
  },

  rejectSuggestedIssue: (index: number) => {
    set((state) => ({
      suggestedIssues: state.suggestedIssues.filter((_, i) => i !== index),
    }));
  },

  setProvider: (provider: AIProvider) => {
    set({ selectedProvider: provider });
  },
}));
