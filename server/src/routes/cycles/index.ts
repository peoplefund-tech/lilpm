/**
 * Cycle Routes — /api/:teamId/cycles/*
 *
 * Endpoints:
 *   POST   /                  — Create cycle
 *   GET    /                  — List team cycles
 *   GET    /:cycleId          — Get cycle detail
 *   PUT    /:cycleId          — Update cycle
 *   DELETE /:cycleId          — Delete cycle
 *   GET    /:cycleId/issues   — Get issues in cycle
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cycles, issues } from '../../db/schema.js';
import { checkTeamAccess } from '../../plugins/team-access.js';

export const cycleRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST / — Create cycle ─────────────────────────────────────────────
  fastify.post<{ Params: { teamId: string } }>(
    '/',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId } = request.params;
      const { name, number, description, startDate, endDate, status } = request.body as any;

      if (!name) {
        return reply.status(400).send({ error: 'name is required' });
      }

      const [cycle] = await db.insert(cycles).values({
        teamId,
        name,
        number: number || null,
        description: description || null,
        startDate: startDate || null,
        endDate: endDate || null,
        status: status || 'upcoming',
      }).returning();

      return reply.status(201).send(cycle);
    }
  );

  // ── GET / — List team cycles ──────────────────────────────────────────
  fastify.get<{ Params: { teamId: string } }>(
    '/',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId } = request.params;

      const rows = await db
        .select()
        .from(cycles)
        .where(eq(cycles.teamId, teamId))
        .orderBy(desc(cycles.createdAt));

      return reply.send(rows);
    }
  );

  // ── GET /:cycleId — Get cycle detail ──────────────────────────────────
  fastify.get<{ Params: { teamId: string; cycleId: string } }>(
    '/:cycleId',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId, cycleId } = request.params;

      const [cycle] = await db
        .select()
        .from(cycles)
        .where(and(eq(cycles.id, cycleId), eq(cycles.teamId, teamId)))
        .limit(1);

      if (!cycle) {
        return reply.status(404).send({ error: 'Cycle not found' });
      }

      return reply.send(cycle);
    }
  );

  // ── PUT /:cycleId — Update cycle ──────────────────────────────────────
  fastify.put<{ Params: { teamId: string; cycleId: string } }>(
    '/:cycleId',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId, cycleId } = request.params;
      const updates = request.body as any;

      const [updated] = await db
        .update(cycles)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(and(eq(cycles.id, cycleId), eq(cycles.teamId, teamId)))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'Cycle not found' });
      }

      return reply.send(updated);
    }
  );

  // ── DELETE /:cycleId — Delete cycle ───────────────────────────────────
  fastify.delete<{ Params: { teamId: string; cycleId: string } }>(
    '/:cycleId',
    { preHandler: [checkTeamAccess({ requireRole: 'admin' })] },
    async (request, reply) => {
      const { teamId, cycleId } = request.params;

      await db
        .delete(cycles)
        .where(and(eq(cycles.id, cycleId), eq(cycles.teamId, teamId)));

      return reply.status(204).send();
    }
  );

  // ── GET /:cycleId/issues — Get issues in cycle ────────────────────────
  fastify.get<{ Params: { teamId: string; cycleId: string } }>(
    '/:cycleId/issues',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId, cycleId } = request.params;

      // Verify cycle exists and belongs to team
      const [cycle] = await db
        .select()
        .from(cycles)
        .where(and(eq(cycles.id, cycleId), eq(cycles.teamId, teamId)))
        .limit(1);

      if (!cycle) {
        return reply.status(404).send({ error: 'Cycle not found' });
      }

      const rows = await db
        .select()
        .from(issues)
        .where(eq(issues.cycleId, cycleId))
        .orderBy(desc(issues.createdAt));

      return reply.send(rows);
    }
  );
};
