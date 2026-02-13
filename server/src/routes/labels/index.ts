/**
 * Label Routes — /api/teams/:teamId/labels/*
 *                /api/teams/:teamId/issues/:issueId/labels/*
 *
 * Endpoints:
 *   POST   /                                           — Create label
 *   GET    /                                           — List labels
 *   PUT    /:labelId                                   — Update label
 *   DELETE /:labelId                                   — Delete label
 *   POST   /api/teams/:teamId/issues/:issueId/labels   — Add label to issue
 *   DELETE /api/teams/:teamId/issues/:issueId/labels/:labelId — Remove label from issue
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { labels, issueLabels, activities } from '../../db/schema.js';
import { requireAuth } from '../../plugins/auth.js';
import { checkTeamAccess } from '../../plugins/team-access.js';

export const labelRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST / — Create label ─────────────────────────────────────────────
  fastify.post<{ Params: { teamId: string } }>(
    '/',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId } = request.params;
      const { name, color, description } = request.body as any;

      if (!name) {
        return reply.status(400).send({ error: 'name is required' });
      }

      const [label] = await db
        .insert(labels)
        .values({
          teamId,
          name,
          color: color || '#6366F1',
          description: description || null,
        })
        .returning();

      return reply.status(201).send(label);
    },
  );

  // ── GET / — List labels ───────────────────────────────────────────────
  fastify.get<{ Params: { teamId: string } }>(
    '/',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { teamId } = request.params;

      return db
        .select()
        .from(labels)
        .where(eq(labels.teamId, teamId))
        .orderBy(asc(labels.name));
    },
  );

  // ── PUT /:labelId — Update label ──────────────────────────────────────
  fastify.put<{ Params: { teamId: string; labelId: string } }>(
    '/:labelId',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { teamId, labelId } = request.params;
      const { name, color, description } = request.body as any;

      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;
      if (description !== undefined) updates.description = description;

      const [updated] = await db
        .update(labels)
        .set(updates)
        .where(and(eq(labels.id, labelId), eq(labels.teamId, teamId)))
        .returning();

      if (!updated) {
        throw request.server.httpErrors.notFound('Label not found');
      }

      return updated;
    },
  );

  // ── DELETE /:labelId — Delete label ───────────────────────────────────
  fastify.delete<{ Params: { teamId: string; labelId: string } }>(
    '/:labelId',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { teamId, labelId } = request.params;

      await db
        .delete(labels)
        .where(and(eq(labels.id, labelId), eq(labels.teamId, teamId)));

      return { success: true };
    },
  );

  // ── Issue-label association routes ─────────────────────────────────────

  // POST /issues/:issueId/labels — Add label to issue
  fastify.post<{ Params: { teamId: string; issueId: string } }>(
    '/issues/:issueId/labels',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { issueId } = request.params;
      const { labelId } = request.body as { labelId: string };

      if (!labelId) {
        return reply.status(400).send({ error: 'labelId is required' });
      }

      const [row] = await db
        .insert(issueLabels)
        .values({ issueId, labelId })
        .onConflictDoNothing()
        .returning();

      // Activity record
      await db.insert(activities).values({
        issueId,
        userId: request.userId,
        type: 'label_added',
        data: { labelId },
      });

      return reply.status(201).send(row || { issueId, labelId });
    },
  );

  // DELETE /issues/:issueId/labels/:labelId — Remove label from issue
  fastify.delete<{ Params: { teamId: string; issueId: string; labelId: string } }>(
    '/issues/:issueId/labels/:labelId',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { issueId, labelId } = request.params;

      await db
        .delete(issueLabels)
        .where(
          and(eq(issueLabels.issueId, issueId), eq(issueLabels.labelId, labelId)),
        );

      // Activity record
      await db.insert(activities).values({
        issueId,
        userId: request.userId,
        type: 'label_removed',
        data: { labelId },
      });

      return { success: true };
    },
  );
};
