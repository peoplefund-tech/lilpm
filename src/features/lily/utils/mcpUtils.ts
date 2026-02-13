/**
 * MCP (Model Context Protocol) utilities for Lily AI chat
 */
import { apiClient } from '@/lib/api/client';
import type { MCPConnector } from '@/types/mcp';
import type { Issue } from '@/types';

/**
 * MCP Tool Call structure
 */
export interface MCPToolCall {
    tool: string;
    action: string;
    params: Record<string, unknown>;
}

/**
 * Parse MCP tool calls from AI response
 */
export function parseMCPToolCalls(content: string): MCPToolCall[] {
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

/**
 * Extract MCP config from connector (supports multiple JSON formats)
 */
export function extractMCPConfig(connector: MCPConnector): { endpoint: string; apiKey: string } {
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

/**
 * Call MCP server through API proxy (avoids CORS)
 */
export async function callMCPServer(
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

        // Call through API proxy to avoid CORS
        const res = await apiClient.post<{ success: boolean; data?: unknown; error?: string; attempts?: unknown }>('/mcp-proxy', {
            endpoint,
            apiKey,
            action,
            params,
        });

        if (res.error) {
            console.error('[MCP] Call failed:', res.error);
            return {
                success: false,
                error: res.error,
            };
        }

        const result = res.data;
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

/**
 * Parse issue suggestions from AI response with enhanced format support
 */
export function parseIssueSuggestions(content: string): Partial<Issue>[] {
    const issues: Partial<Issue>[] = [];
    const regex = /\[ISSUE_SUGGESTION\]([\s\S]*?)\[\/ISSUE_SUGGESTION\]/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        const block = match[1];
        const title = block.match(/title:\s*(.+)/)?.[1]?.trim();
        const description = block.match(/description:\s*(.+)/)?.[1]?.trim();
        const priority = block.match(/priority:\s*(.+)/)?.[1]?.trim() as Issue['priority'] | undefined;
        const status = block.match(/status:\s*(.+)/)?.[1]?.trim() as Issue['status'] | undefined;
        const dueDate = block.match(/dueDate:\s*(.+)/)?.[1]?.trim();
        const labels = block.match(/labels:\s*(.+)/)?.[1]?.trim()?.split(',').map(l => l.trim());

        if (title) {
            issues.push({
                title,
                description: description || '',
                priority: priority || 'medium',
                status: status || 'todo',
                dueDate: dueDate || undefined,
                labels: labels || [],
            });
        }
    }

    return issues;
}
