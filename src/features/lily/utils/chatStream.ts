import { apiClient, API_BASE_URL } from '@/lib/api/client';
import type { AIProvider } from '@/types';
import type { MCPConnector } from '@/types/mcp';

// API endpoint for lily-chat
const CHAT_ENDPOINT = '/lily-chat';

// File attachment type for API
export interface FileAttachment {
    name: string;
    type: string;
    size: number;
    base64?: string;
    category: string;
}

export interface StreamChatOptions {
    messages: { role: 'user' | 'assistant'; content: string }[];
    provider: AIProvider;
    mcpConnectors?: MCPConnector[];
    canvasMode?: boolean;
    files?: FileAttachment[];
    onDelta: (text: string) => void;
    onDone: (fullContent: string) => void;
    onError: (error: string) => void;
    signal?: AbortSignal;
}

/**
 * Stream chat with AI via Edge Function
 */
export async function streamChat({
    messages,
    provider,
    mcpConnectors,
    canvasMode,
    files,
    onDelta,
    onDone,
    onError,
    signal,
}: StreamChatOptions) {
    // Prepare active MCP tools info for the AI
    const activeMcpTools = mcpConnectors?.filter(c => c.enabled).map(c => ({
        name: c.name,
        description: c.description,
        category: c.category,
        hasApiEndpoint: !!c.apiEndpoint,
        hasMcpConfig: !!c.mcpConfig,
    }));

    // Prepare files for multimodal API
    const multimodalFiles = files?.map(f => ({
        name: f.name,
        mimeType: f.type,
        base64: f.base64,
        category: f.category,
    }));

    // Use apiClient.fetchRaw for SSE streaming with automatic auth handling
    const resp = await apiClient.fetchRaw(CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages,
            provider,
            stream: true,
            mcpTools: activeMcpTools,
            canvasMode: canvasMode || false,
            files: multimodalFiles,
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

export { CHAT_ENDPOINT, API_BASE_URL };
