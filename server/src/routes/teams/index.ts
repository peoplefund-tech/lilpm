/**
 * Team Routes — /api/teams/*
 *
 * Endpoints:
 *   POST   /                     — Create team
 *   GET    /                     — List user's teams
 *   GET    /:teamId              — Get team detail
 *   PUT    /:teamId              — Update team (admin+)
 *   DELETE /:teamId              — Delete team (owner only)
 *   GET    /:teamId/members      — List members
 *   PUT    /:teamId/members/:userId  — Update member role (admin+)
 *   DELETE /:teamId/members/:userId  — Remove member (admin+)
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { teams, teamMembers, projects, profiles } from '../../db/schema.js';
import { requireAuth } from '../../plugins/auth.js';
import { checkTeamAccess } from '../../plugins/team-access.js';

export const teamRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST / — Create team ──────────────────────────────────────────────
  fastify.post('/', async (request, reply) => {
    requireAuth(request);
    const { name, slug, description, logoUrl, issuePrefix } = request.body as any;

    if (!name || !slug) {
      return reply.status(400).send({ error: 'name and slug are required' });
    }

    // Check slug uniqueness
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, slug))
      .limit(1);

    if (existing) {
      return reply.status(409).send({ error: 'Slug already taken' });
    }

    // Create team
    const [team] = await db.insert(teams).values({
      name,
      slug,
      description: description || null,
      logoUrl: logoUrl || null,
      issuePrefix: issuePrefix || slug.toUpperCase().slice(0, 5),
      createdBy: request.userId,
    }).returning();

    // Add creator as owner
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: request.userId,
      role: 'owner',
    });

    // Create default project
    await db.insert(projects).values({
      teamId: team.id,
      name: 'Default Project',
      slug: 'default',
      status: 'in_progress',
    });

    return reply.status(201).send(team);
  });

  // ── GET / — List user's teams ─────────────────────────────────────────
  fastify.get('/', async (request) => {
    requireAuth(request);

    const rows = await db
      .select({
        team: teams,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, request.userId))
      .orderBy(desc(teams.createdAt));

    return rows.map((r) => ({
      ...r.team,
      role: r.role,
      joinedAt: r.joinedAt,
    }));
  });

  // ── GET /:teamId — Get team detail ────────────────────────────────────
  fastify.get<{ Params: { teamId: string } }>(
    '/:teamId',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { teamId } = request.params;

      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      if (!team) {
        throw request.server.httpErrors.notFound('Team not found');
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId));

      return { ...team, memberCount: countResult.count };
    },
  );

  // ── PUT /:teamId — Update team (admin+) ──────────────────────────────
  fastify.put<{ Params: { teamId: string } }>(
    '/:teamId',
    { preHandler: [checkTeamAccess({ requireRole: 'admin' })] },
    async (request) => {
      const { teamId } = request.params;
      const { name, description, logoUrl, avatarUrl, settings, issuePrefix } = request.body as any;

      const updates: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (logoUrl !== undefined) updates.logoUrl = logoUrl;
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
      if (settings !== undefined) updates.settings = settings;
      if (issuePrefix !== undefined) updates.issuePrefix = issuePrefix;

      const [updated] = await db
        .update(teams)
        .set(updates)
        .where(eq(teams.id, teamId))
        .returning();

      return updated;
    },
  );

  // ── DELETE /:teamId — Delete team (owner only) ────────────────────────
  fastify.delete<{ Params: { teamId: string } }>(
    '/:teamId',
    { preHandler: [checkTeamAccess({ requireRole: 'owner' })] },
    async (request) => {
      const { teamId } = request.params;
      await db.delete(teams).where(eq(teams.id, teamId));
      return { success: true };
    },
  );

  // ── GET /:teamId/members — List members ──────────────────────────────
  fastify.get<{ Params: { teamId: string } }>(
    '/:teamId/members',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { teamId } = request.params;

      const rows = await db
        .select({
          id: teamMembers.id,
          userId: teamMembers.userId,
          role: teamMembers.role,
          joinedAt: teamMembers.joinedAt,
          name: profiles.name,
          email: profiles.email,
          avatarUrl: profiles.avatarUrl,
        })
        .from(teamMembers)
        .leftJoin(profiles, eq(teamMembers.userId, profiles.id))
        .where(eq(teamMembers.teamId, teamId))
        .orderBy(teamMembers.joinedAt);

      return rows;
    },
  );

  // ── PUT /:teamId/members/:userId — Update member role (admin+) ────────
  fastify.put<{ Params: { teamId: string; userId: string } }>(
    '/:teamId/members/:userId',
    { preHandler: [checkTeamAccess({ requireRole: 'admin' })] },
    async (request, reply) => {
      const { teamId, userId } = request.params;
      const { role } = request.body as { role: string };

      if (!role) {
        return reply.status(400).send({ error: 'role is required' });
      }

      // Cannot change owner role unless you are owner
      if (role === 'owner' && (request as any).teamRole !== 'owner') {
        return reply.status(403).send({ error: 'Only owners can assign the owner role' });
      }

      const [updated] = await db
        .update(teamMembers)
        .set({ role: role as any })
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, userId),
          ),
        )
        .returning();

      if (!updated) {
        throw request.server.httpErrors.notFound('Member not found');
      }

      return updated;
    },
  );

  // ── DELETE /:teamId/members/:userId — Remove member (admin+) ─────────
  fastify.delete<{ Params: { teamId: string; userId: string } }>(
    '/:teamId/members/:userId',
    { preHandler: [checkTeamAccess({ requireRole: 'admin' })] },
    async (request, reply) => {
      const { teamId, userId } = request.params;

      // Prevent removing the last owner
      const [member] = await db
        .select({ role: teamMembers.role })
        .from(teamMembers)
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        )
        .limit(1);

      if (member?.role === 'owner') {
        const [ownerCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(teamMembers)
          .where(
            and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, 'owner')),
          );

        if (ownerCount.count <= 1) {
          return reply.status(400).send({ error: 'Cannot remove the last owner' });
        }
      }

      await db
        .delete(teamMembers)
        .where(
          and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
        );

      return { success: true };
    },
  );
};
