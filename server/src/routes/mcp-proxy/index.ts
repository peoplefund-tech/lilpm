/**
 * MCP Proxy Routes — /api/mcp-proxy/*
 *
 * Ports mcp-proxy Edge Function. Proxies requests to MCP endpoints,
 * trying multiple URL patterns until one succeeds.
 *
 * Endpoints:
 *   ALL /*  — Proxy requests to MCP endpoints
 */

import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../plugins/auth.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MCPRequest {
  endpoint: string;
  apiKey?: string;
  action: string;
  params?: Record<string, unknown>;
}

interface PatternAttempt {
  pattern: string;
  status: number;
  error?: string;
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export const mcpProxyRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET / ── Health check ───────────────────────────────────────────────
  fastify.get('/', { config: { skipAuth: true } }, async () => {
    return { status: 'ok', service: 'mcp-proxy' };
  });

  // ── POST / ── Main proxy endpoint ───────────────────────────────────────
  fastify.post('/', async (request, reply) => {
    requireAuth(request);

    const body = request.body as MCPRequest;
    const { endpoint, apiKey, action, params = {} } = body;

    if (!endpoint) {
      return reply.status(400).send({ error: 'endpoint is required' });
    }

    if (!action) {
      return reply.status(400).send({ error: 'action is required' });
    }

    const baseUrl = endpoint.replace(/\/sse$/, '');

    request.log.info({ baseUrl, action }, 'MCP Proxy request');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Try multiple endpoint patterns
    const patterns = [
      { url: `${baseUrl}/tools/${action}`, body: params },
      {
        url: `${baseUrl}/tools/call`,
        body: { name: action, arguments: params },
      },
      {
        url: `${baseUrl}/rpc`,
        body: {
          jsonrpc: '2.0',
          id: Date.now(),
          method: action,
          params,
        },
      },
      { url: `${baseUrl}/call`, body: { method: action, params } },
      { url: `${baseUrl}/api/${action}`, body: params },
      { url: `${baseUrl}/${action}`, body: params },
    ];

    const attempts: PatternAttempt[] = [];

    for (const pattern of patterns) {
      try {
        request.log.debug({ url: pattern.url }, 'MCP Proxy trying pattern');

        const response = await fetch(pattern.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(pattern.body),
        });

        if (response.ok) {
          const data = await response.json();
          request.log.info({ url: pattern.url }, 'MCP Proxy success');

          return {
            success: true,
            data: data.result || data.data || data,
            pattern: pattern.url,
          };
        } else {
          const errorText = await response.text();
          attempts.push({
            pattern: pattern.url,
            status: response.status,
            error: errorText.substring(0, 200),
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        attempts.push({ pattern: pattern.url, status: 0, error });
      }
    }

    // All patterns failed
    request.log.warn({ attempts }, 'MCP Proxy: all patterns failed');
    return reply.status(502).send({
      error: 'All MCP endpoint patterns failed',
      attempts,
    });
  });

  // ── Wildcard: ALL /* ── Forward any sub-path requests ───────────────────
  fastify.all<{
    Params: { '*': string };
  }>('/*', async (request, reply) => {
    requireAuth(request);

    // For wildcard routes, extract target info from body or query
    const body = (request.body as Record<string, any>) || {};
    const query = request.query as Record<string, any>;

    const endpoint = body.endpoint || query.endpoint;
    const apiKey = body.apiKey || query.apiKey;

    if (!endpoint) {
      return reply
        .status(400)
        .send({ error: 'endpoint is required in body or query' });
    }

    const subPath = request.params['*'];
    const targetUrl = `${endpoint.replace(/\/+$/, '')}/${subPath}`;

    request.log.info({ targetUrl, method: request.method }, 'MCP Proxy wildcard');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Forward content-type from original request if present
    const contentType = request.headers['content-type'];
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    try {
      const fetchOptions: RequestInit = {
        method: request.method,
        headers,
      };

      // Include body for non-GET requests
      if (request.method !== 'GET' && request.method !== 'HEAD' && body) {
        // Remove proxy-specific fields before forwarding
        const { endpoint: _, apiKey: __, ...forwardBody } = body;
        fetchOptions.body = JSON.stringify(forwardBody);
      }

      const response = await fetch(targetUrl, fetchOptions);
      const responseData = await response.text();

      // Try to parse as JSON, fall back to text
      try {
        const jsonData = JSON.parse(responseData);
        return reply.status(response.status).send(jsonData);
      } catch {
        return reply
          .status(response.status)
          .type('text/plain')
          .send(responseData);
      }
    } catch (err) {
      request.log.error(err, 'MCP Proxy wildcard error');
      return reply.status(502).send({
        error: err instanceof Error ? err.message : 'Proxy request failed',
      });
    }
  });
};
