/**
 * Team Access Middleware
 *
 * Verifies the authenticated user is a member of the given team.
 * Replaces all 98 PostgreSQL RLS policies with application-level checks.
 */

import type { FastifyRequest } from 'fastify';
import { db } from '../db/index.js';
import { teamMembers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from './auth.js';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    teamRole: string | null;
  }
}

export interface TeamAccessOptions {
  /** Minimum role required. Default: 'member' (any role accepted) */
  requireRole?: 'owner' | 'admin' | 'member' | 'guest';
}

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 40,
  admin: 30,
  member: 20,
  guest: 10,
};

/**
 * Factory that returns a preHandler checking team membership.
 *
 * Usage in routes:
 *   fastify.get('/teams/:teamId/projects', {
 *     preHandler: [checkTeamAccess()],
 *   }, handler);
 */
export function checkTeamAccess(opts: TeamAccessOptions = {}) {
  const minRole = opts.requireRole || 'guest';
  const minLevel = ROLE_HIERARCHY[minRole] || 0;

  return async (request: FastifyRequest<{ Params: { teamId: string } }>) => {
    requireAuth(request);

    const { teamId } = request.params;
    if (!teamId) {
      throw request.server.httpErrors.badRequest('teamId is required');
    }

    const [membership] = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, request.userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw request.server.httpErrors.forbidden('Not a member of this team');
    }

    const userLevel = ROLE_HIERARCHY[membership.role] || 0;
    if (userLevel < minLevel) {
      throw request.server.httpErrors.forbidden(
        `Requires role '${minRole}' or higher, you have '${membership.role}'`,
      );
    }

    // Store role on request for later use
    (request as any).teamRole = membership.role;
  };
}

/**
 * Quick check: is user member of team? (boolean, no throw)
 */
export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
    )
    .limit(1);
  return !!row;
}
