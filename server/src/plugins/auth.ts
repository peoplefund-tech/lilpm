/**
 * Auth Plugin — JWT verification for Fastify
 *
 * Decorates request with `userId` after verifying the access token.
 * Routes can opt-out of auth via `config.skipAuth: true`.
 */

import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import type { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    userId: string | null;
  }
  interface FastifyContextConfig {
    skipAuth?: boolean;
  }
}

interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

const authPluginCb: FastifyPluginCallback = (fastify, _opts, done) => {
  // Decorate every request with userId
  fastify.decorateRequest('userId', null);

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    // Allow opting out per-route
    if (request.routeOptions.config?.skipAuth) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return; // No token → unauthenticated (routes can check request.userId)
    }

    const token = authHeader.slice(7);

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      request.userId = payload.sub;
    } catch (err) {
      // Expired or malformed tokens → still allow request (route can enforce)
      request.log.debug({ err }, 'JWT verification failed');
    }
  });

  done();
};

export const authPlugin = fp(authPluginCb, {
  name: 'auth-plugin',
  fastify: '5.x',
});

/**
 * Guard: throws 401 if request is not authenticated.
 * Use inside route handlers: `requireAuth(request)`
 */
export function requireAuth(request: FastifyRequest): asserts request is FastifyRequest & { userId: string } {
  if (!request.userId) {
    throw request.server.httpErrors.unauthorized('Authentication required');
  }
}
