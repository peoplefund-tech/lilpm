import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { conversationService, messageService } from '@/lib/services/conversationService';
import type { LilyMessage, PRDDocument, Issue, AIProvider } from '@/types';
import type { MCPConnector } from '@/types/mcp';

// Fallback to hardcoded URL if env var is undefined
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lbzjnhlribtfwnoydpdv.supabase.co';
const CHAT_URL = `${SUPABASE_URL}/functions/v1/lily-chat`;
const MCP_PROXY_URL = `${SUPABASE_URL}/functions/v1/mcp-proxy`;

// Artifact types for real-time preview
interface Artifact {
  type: 'prd' | 'issue' | 'code' | 'document';
  title: string;
  content: string;
  isGenerating: boolean;
}

// Memory/compression state
interface ConversationMemory {
  summary: string;
  keyPoints: string[];
  lastUpdated: string;
  messageCount: number;
}

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
  
  // Artifact state for real-time preview
  artifact: Artifact | null;
  showArtifact: boolean;
  
  // Memory/compression state
  conversationMemory: ConversationMemory | null;
  
  // Actions
  sendMessage: (message: string, context?: { teamId?: string; projectId?: string; mcpConnectors?: MCPConnector[]; canvasMode?: boolean }) => Promise<void>;
  stopGeneration: () => void;
  loadConversations: (teamId?: string) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  createConversation: (teamId?: string, projectId?: string) => Promise<string>;
  deleteConversation: (conversationId: string) => Promise<void>;
  updateConversationTitle: (conversationId: string, title: string) => Promise<void>;
  pinConversation: (conversationId: string, pinned: boolean) => Promise<void>;
  reorderConversation: (conversationId: string, newIndex: number) => void;
  loadDataSources: () => Promise<void>;
  generatePRD: () => Promise<void>;
  generateTickets: (teamId: string) => Promise<Issue[]>;
  analyzeProject: (teamId: string) => Promise<void>;
  clearChat: () => void;
  acceptSuggestedIssue: (index: number) => void;
  rejectSuggestedIssue: (index: number) => void;
  setProvider: (provider: AIProvider) => void;
  compressConversation: () => Promise<void>;
  
  // Artifact actions
  setArtifact: (artifact: Artifact | null) => void;
  updateArtifactContent: (content: string) => void;
  toggleArtifactPanel: () => void;
}

// Parse MCP tool calls from AI response
interface MCPToolCall {
  tool: string;
  action: string;
  params: Record<string, unknown>;
}

function parseMCPToolCalls(content: string): MCPToolCall[] {
  const toolCalls: MCPToolCall[] = [];
  const regex = /\[MCP_TOOL_CALL\]([\s\S]*?)\[\/MCP_TOOL_CALL\]/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const block = match[1];
    const tool = block.match(/tool:\s*(.+)/)?.[1]?.trim();
    const action = block.match(/action:\s*(.+)/)?.[1]?.trim();
    const paramsMatch = block.match(/params:\s*(\{[\s\S]*\}|\{\})/);
    
    let params = {};
    if (paramsMatch) {
      try {
        params = JSON.parse(paramsMatch[1]);
      } catch {
        params = {};
      }
    }
    
    if (tool && action) {
      toolCalls.push({ tool, action, params });
    }
  }
  
  return toolCalls;
}

// Extract MCP config from connector (supports multiple JSON formats)
function extractMCPConfig(connector: MCPConnector): { endpoint: string; apiKey: string } {
  let endpoint = connector.apiEndpoint || '';
  let apiKey = connector.apiKey || '';
  const mcpConfig = connector.mcpConfig as any;
  
  if (mcpConfig) {
    // Format 1: { url: "...", headers: { Authorization: "Bearer ..." } }
    if (mcpConfig.url) {
      endpoint = mcpConfig.url;
      if (mcpConfig.headers?.Authorization) {
        apiKey = mcpConfig.headers.Authorization.replace('Bearer ', '');
      }
    }
    // Format 2: { command: "npx", args: [...] }
    else if (mcpConfig.args) {
      const urlArg = mcpConfig.args.find((arg: string) => arg.startsWith('http'));
      if (urlArg) endpoint = urlArg;
      
      const authIndex = mcpConfig.args.findIndex((arg: string) => arg === '--header');
      if (authIndex !== -1 && mcpConfig.args[authIndex + 1]) {
        const authHeader = mcpConfig.args[authIndex + 1];
        if (authHeader.startsWith('Authorization: Bearer ')) {
          apiKey = authHeader.replace('Authorization: Bearer ', '');
        }
      }
    }
    // Format 3: mcpServers wrapper
    else if (mcpConfig.mcpServers) {
      const serverName = Object.keys(mcpConfig.mcpServers)[0];
      const server = mcpConfig.mcpServers[serverName];
      if (server?.url) {
        endpoint = server.url;
        if (server.headers?.Authorization) {
          apiKey = server.headers.Authorization.replace('Bearer ', '');
        }
      } else if (server?.args) {
        const urlArg = server.args.find((arg: string) => arg.startsWith('http'));
        if (urlArg) endpoint = urlArg;
      }
    }
  }
  
  return { endpoint, apiKey };
}

// Call MCP server through Edge Function proxy (avoids CORS)
async function callMCPServer(
  connector: MCPConnector,
  action: string,
  params: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const { endpoint, apiKey } = extractMCPConfig(connector);
    
    if (!endpoint) {
      return { success: false, error: 'No API endpoint configured' };
    }
    
    console.log('[MCP] Calling via proxy:', endpoint, action);
    
    // Get auth token for Edge Function
    const { data: { session } } = await supabase.auth.getSession();
    
    // Call through Edge Function proxy to avoid CORS
    const response = await fetch(MCP_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        endpoint,
        apiKey,
        action,
        params,
      }),
    });
    
    const result = await response.json();
    console.log('[MCP] Proxy response:', result);
    
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { 
        success: false, 
        error: result.error || 'MCP call failed',
        data: result.attempts,
      };
    }
  } catch (error) {
    console.error('[MCP] Call failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'MCP call failed' 
    };
  }
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
  mcpConnectors,
  canvasMode,
  onDelta,
  onDone,
  onError,
  signal,
}: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  provider: AIProvider;
  mcpConnectors?: MCPConnector[];
  canvasMode?: boolean;
  onDelta: (text: string) => void;
  onDone: (fullContent: string) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}) {
  const { data: { session } } = await supabase.auth.getSession();

  // Prepare active MCP tools info for the AI
  const activeMcpTools = mcpConnectors?.filter(c => c.enabled).map(c => ({
    name: c.name,
    description: c.description,
    category: c.category,
    hasApiEndpoint: !!c.apiEndpoint,
    hasMcpConfig: !!c.mcpConfig,
  }));

  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ 
      messages, 
      provider, 
      stream: true,
      mcpTools: activeMcpTools,
      canvasMode: canvasMode || false,
    }),
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

// Constants for conversation compression
const MESSAGES_BEFORE_COMPRESSION = 20; // Compress after this many messages
const MESSAGES_TO_KEEP_FULL = 6; // Keep this many recent messages in full

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
  artifact: null,
  showArtifact: false,
  conversationMemory: null,

  // Compress conversation when it gets too long
  compressConversation: async () => {
    const { messages, selectedProvider } = get();
    
    if (messages.length < MESSAGES_BEFORE_COMPRESSION) return;
    
    // Get messages to summarize (all except the most recent ones)
    const messagesToSummarize = messages.slice(0, -MESSAGES_TO_KEEP_FULL);
    if (messagesToSummarize.length === 0) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Create summary prompt
      const summaryMessages = [
        {
          role: 'user' as const,
          content: `Please create a concise summary of the following conversation. Include:
1. Main topics discussed
2. Key decisions made
3. Important context needed for future messages
4. Any tasks or requests mentioned

Conversation to summarize:
${messagesToSummarize.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 500)}${m.content.length > 500 ? '...' : ''}`).join('\n\n')}

Provide a summary in 2-3 paragraphs.`
        }
      ];
      
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          messages: summaryMessages,
          provider: selectedProvider === 'auto' ? 'anthropic' : selectedProvider,
          stream: false,
        }),
      });
      
      if (!resp.ok) {
        console.error('Failed to compress conversation');
        return;
      }
      
      const data = await resp.json();
      const summary = data.content || data.message || '';
      
      if (summary) {
        // Store memory and keep only recent messages
        const recentMessages = messages.slice(-MESSAGES_TO_KEEP_FULL);
        
        const newMemory: ConversationMemory = {
          summary,
          keyPoints: [],
          lastUpdated: new Date().toISOString(),
          messageCount: messages.length,
        };
        
        set({
          conversationMemory: newMemory,
          messages: recentMessages,
        });
        
        console.log('[Memory] Conversation compressed:', {
          originalCount: messages.length,
          keptCount: recentMessages.length,
          summaryLength: summary.length,
        });
      }
    } catch (error) {
      console.error('Failed to compress conversation:', error);
    }
  },

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

  updateConversationTitle: async (conversationId: string, title: string) => {
    try {
      await conversationService.updateConversation(conversationId, { title });
      set((state) => ({
        conversations: state.conversations.map(c => 
          c.id === conversationId ? { ...c, title } : c
        ),
      }));
    } catch (error) {
      console.error('Failed to update conversation title:', error);
    }
  },

  pinConversation: async (conversationId: string, pinned: boolean) => {
    try {
      // Store pinned state in localStorage since we don't have a DB field for it
      const pinnedConversations = JSON.parse(localStorage.getItem('pinnedConversations') || '[]') as string[];
      
      if (pinned && !pinnedConversations.includes(conversationId)) {
        pinnedConversations.push(conversationId);
      } else if (!pinned) {
        const index = pinnedConversations.indexOf(conversationId);
        if (index > -1) pinnedConversations.splice(index, 1);
      }
      
      localStorage.setItem('pinnedConversations', JSON.stringify(pinnedConversations));
      
      // Sort conversations to put pinned ones first
      set((state) => ({
        conversations: [...state.conversations].sort((a, b) => {
          const aIsPinned = pinnedConversations.includes(a.id);
          const bIsPinned = pinnedConversations.includes(b.id);
          if (aIsPinned && !bIsPinned) return -1;
          if (!aIsPinned && bIsPinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }),
      }));
    } catch (error) {
      console.error('Failed to pin conversation:', error);
    }
  },

  reorderConversation: (conversationId: string, newIndex: number) => {
    set((state) => {
      const conversations = [...state.conversations];
      const currentIndex = conversations.findIndex(c => c.id === conversationId);
      if (currentIndex === -1) return state;
      
      const [removed] = conversations.splice(currentIndex, 1);
      conversations.splice(newIndex, 0, removed);
      
      return { conversations };
    });
  },

  sendMessage: async (message: string, context?: { teamId?: string; projectId?: string; mcpConnectors?: MCPConnector[]; canvasMode?: boolean }) => {
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

    // Save user message to database if we have a conversation
    const conversationId = get().currentConversationId;
    if (conversationId) {
      try {
        await messageService.createMessage(conversationId, 'user', message);
      } catch (err) {
        console.error('Failed to save user message:', err);
      }
    }

    // Prepare messages for API with memory context
    const { messages, conversationMemory } = get();
    const apiMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];
    
    // If we have memory from compressed conversation, include it first
    if (conversationMemory?.summary) {
      apiMessages.push({
        role: 'system',
        content: `[Previous Conversation Summary]\n${conversationMemory.summary}\n\n[Continue from here with the recent messages below]`,
      });
    }
    
    // Add current messages
    messages.forEach(m => {
      apiMessages.push({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      });
    });
    apiMessages.push({ role: 'user', content: message });
    
    // Check if we need to compress after this message
    const totalMessages = messages.length + 1;
    if (totalMessages >= MESSAGES_BEFORE_COMPRESSION && !conversationMemory) {
      // Schedule compression after response
      setTimeout(() => get().compressConversation(), 2000);
    }

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
        mcpConnectors: context?.mcpConnectors,
        canvasMode: context?.canvasMode,
        signal: abortController.signal,
        onDelta: (chunk) => updateAssistantMessage(chunk),
        onDone: async (fullContent) => {
          const issues = parseIssueSuggestions(fullContent);
          const mcpCalls = parseMCPToolCalls(fullContent);
          
          // Process MCP tool calls
          if (mcpCalls.length > 0 && context?.mcpConnectors) {
            for (const call of mcpCalls) {
              // Find matching connector
              const connector = context.mcpConnectors.find(
                c => c.enabled && (
                  c.name.toLowerCase().includes(call.tool.toLowerCase()) ||
                  call.tool.toLowerCase().includes(c.name.toLowerCase())
                )
              );
              
              if (connector) {
                // Update message to show we're calling MCP
                const mcpStatusMsg = `\n\n⏳ **MCP 호출 중**: ${connector.name} - ${call.action}...`;
                updateAssistantMessage(mcpStatusMsg);
                
                // Call MCP server
                const result = await callMCPServer(connector, call.action, call.params);
                
                // Add result to conversation
                let resultMsg = '';
                if (result.success) {
                  resultMsg = `\n\n✅ **MCP 결과** (${connector.name}):\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\``;
                } else {
                  resultMsg = `\n\n❌ **MCP 오류** (${connector.name}): ${result.error}`;
                }
                updateAssistantMessage(resultMsg);
              } else {
                // Connector not found
                updateAssistantMessage(`\n\n⚠️ **MCP 커넥터를 찾을 수 없음**: ${call.tool}. Settings > MCP에서 커넥터를 활성화해주세요.`);
              }
            }
          }
          
          // Save assistant message to database if we have a conversation
          const convId = get().currentConversationId;
          if (convId && fullContent) {
            try {
              await messageService.createMessage(convId, 'assistant', fullContent);
              // Update conversation title if this is the first response
              const conversation = get().conversations.find(c => c.id === convId);
              if (conversation && !conversation.title) {
                // Generate a title from the first user message
                const firstUserMsg = get().messages.find(m => m.role === 'user');
                if (firstUserMsg) {
                  const title = firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
                  await conversationService.updateConversation(convId, { title });
                  set(state => ({
                    conversations: state.conversations.map(c => 
                      c.id === convId ? { ...c, title } : c
                    ),
                  }));
                }
              }
            } catch (err) {
              console.error('Failed to save assistant message:', err);
            }
          }

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

  // Artifact actions
  setArtifact: (artifact: Artifact | null) => {
    set({ artifact, showArtifact: artifact !== null });
  },

  updateArtifactContent: (content: string) => {
    set((state) => ({
      artifact: state.artifact ? { ...state.artifact, content } : null,
    }));
  },

  toggleArtifactPanel: () => {
    set((state) => ({ showArtifact: !state.showArtifact }));
  },
}));

// Export Artifact type for use in components
export type { Artifact };
