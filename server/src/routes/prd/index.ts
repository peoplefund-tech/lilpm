/**
 * PRD Routes — /api/:teamId/prd/*
 *
 * Endpoints:
 *   POST   /                  — Create PRD
 *   GET    /                  — List team PRDs
 *   GET    /:prdId            — Get PRD detail
 *   PUT    /:prdId            — Update PRD
 *   DELETE /:prdId            — Delete PRD
 *   GET    /:prdId/versions   — Get PRD versions
 *   POST   /:prdId/versions   — Create PRD version
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { prdDocuments, prdVersions } from '../../db/schema.js';
import { checkTeamAccess } from '../../plugins/team-access.js';

export const prdRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST / — Create PRD ───────────────────────────────────────────────
  fastify.post<{ Params: { teamId: string } }>(
    '/',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId } = request.params;
      const {
        conversationId,
        projectId,
        title,
        overview,
        content,
        goals,
        userStories,
        requirements,
        timeline,
        status
      } = request.body as any;

      const [prd] = await db.insert(prdDocuments).values({
        teamId,
        conversationId: conversationId || null,
        projectId: projectId || null,
        createdBy: request.userId,
        title: title || null,
        overview: overview || null,
        content: content || null,
        goals: goals || [],
        userStories: userStories || [],
        requirements: requirements || [],
        timeline: timeline || null,
        status: status || 'draft',
        version: 1,
      }).returning();

      return reply.status(201).send(prd);
    }
  );

  // ── GET / — List team PRDs ────────────────────────────────────────────
  fastify.get<{ Params: { teamId: string } }>(
    '/',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId } = request.params;
      const { includeArchived } = request.query as any;

      let query = db
        .select()
        .from(prdDocuments)
        .where(eq(prdDocuments.teamId, teamId));

      if (!includeArchived) {
        query = query.where(isNull(prdDocuments.archivedAt)) as any;
      }

      const rows = await query.orderBy(desc(prdDocuments.updatedAt));

      return reply.send(rows);
    }
  );

  // ── GET /:prdId — Get PRD detail ──────────────────────────────────────
  fastify.get<{ Params: { teamId: string; prdId: string } }>(
    '/:prdId',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId, prdId } = request.params;

      const [prd] = await db
        .select()
        .from(prdDocuments)
        .where(and(eq(prdDocuments.id, prdId), eq(prdDocuments.teamId, teamId)))
        .limit(1);

      if (!prd) {
        return reply.status(404).send({ error: 'PRD not found' });
      }

      return reply.send(prd);
    }
  );

  // ── PUT /:prdId — Update PRD ──────────────────────────────────────────
  fastify.put<{ Params: { teamId: string; prdId: string } }>(
    '/:prdId',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId, prdId } = request.params;
      const updates = request.body as any;

      const [updated] = await db
        .update(prdDocuments)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(and(eq(prdDocuments.id, prdId), eq(prdDocuments.teamId, teamId)))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'PRD not found' });
      }

      return reply.send(updated);
    }
  );

  // ── DELETE /:prdId — Delete PRD (soft delete) ─────────────────────────
  fastify.delete<{ Params: { teamId: string; prdId: string } }>(
    '/:prdId',
    { preHandler: [checkTeamAccess({ requireRole: 'admin' })] },
    async (request, reply) => {
      const { teamId, prdId } = request.params;

      // Soft delete by setting archivedAt
      await db
        .update(prdDocuments)
        .set({ archivedAt: new Date() })
        .where(and(eq(prdDocuments.id, prdId), eq(prdDocuments.teamId, teamId)));

      return reply.status(204).send();
    }
  );

  // ── GET /:prdId/versions — Get PRD versions ───────────────────────────
  fastify.get<{ Params: { teamId: string; prdId: string } }>(
    '/:prdId/versions',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId, prdId } = request.params;

      // Verify PRD exists and belongs to team
      const [prd] = await db
        .select()
        .from(prdDocuments)
        .where(and(eq(prdDocuments.id, prdId), eq(prdDocuments.teamId, teamId)))
        .limit(1);

      if (!prd) {
        return reply.status(404).send({ error: 'PRD not found' });
      }

      const rows = await db
        .select()
        .from(prdVersions)
        .where(eq(prdVersions.prdDocumentId, prdId))
        .orderBy(desc(prdVersions.versionNumber));

      return reply.send(rows);
    }
  );

  // ── POST /:prdId/versions — Create PRD version ────────────────────────
  fastify.post<{ Params: { teamId: string; prdId: string } }>(
    '/:prdId/versions',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId, prdId } = request.params;
      const { pageId, versionNumber, title, content, description } = request.body as any;

      // Verify PRD exists and belongs to team
      const [prd] = await db
        .select()
        .from(prdDocuments)
        .where(and(eq(prdDocuments.id, prdId), eq(prdDocuments.teamId, teamId)))
        .limit(1);

      if (!prd) {
        return reply.status(404).send({ error: 'PRD not found' });
      }

      const [version] = await db.insert(prdVersions).values({
        prdDocumentId: prdId,
        pageId: pageId || null,
        versionNumber: versionNumber || 1,
        title: title || null,
        content: content || null,
        description: description || null,
        createdBy: request.userId,
      }).returning();

      return reply.status(201).send(version);
    }
  );
};
