/**
 * Project Routes — /api/teams/:teamId/projects/*
 *
 * Endpoints:
 *   POST   /                          — Create project
 *   GET    /                          — List projects (with issue counts)
 *   GET    /:projectId                — Get project detail
 *   PUT    /:projectId                — Update project
 *   DELETE /:projectId                — Delete project (admin+)
 *   GET    /:projectId/members        — List project members
 *   POST   /:projectId/members        — Add project member
 *   DELETE /:projectId/members/:userId — Remove project member
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { projects, issues, projectMembers, profiles } from '../../db/schema.js';
import { requireAuth } from '../../plugins/auth.js';
import { checkTeamAccess } from '../../plugins/team-access.js';

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST / — Create project ───────────────────────────────────────────
  fastify.post<{ Params: { teamId: string } }>(
    '/',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId } = request.params;
      const { name, slug, description, color, icon, leadId, status, startDate, targetDate } =
        request.body as any;

      if (!name) {
        return reply.status(400).send({ error: 'name is required' });
      }

      const [project] = await db
        .insert(projects)
        .values({
          teamId,
          name,
          slug: slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          description: description || null,
          color: color || '#6366F1',
          icon: icon || null,
          leadId: leadId || null,
          status: status || 'planned',
          startDate: startDate || null,
          targetDate: targetDate || null,
        })
        .returning();

      return reply.status(201).send(project);
    },
  );

  // ── GET / — List projects with issue counts ───────────────────────────
  fastify.get<{ Params: { teamId: string } }>(
    '/',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { teamId } = request.params;

      const projectList = await db
        .select()
        .from(projects)
        .where(eq(projects.teamId, teamId))
        .orderBy(desc(projects.createdAt));

      // Get issue counts per status for each project
      const issueCounts = await db
        .select({
          projectId: issues.projectId,
          status: issues.status,
          count: sql<number>`count(*)::int`,
        })
        .from(issues)
        .where(eq(issues.teamId, teamId))
        .groupBy(issues.projectId, issues.status);

      const countMap = new Map<string, Record<string, number>>();
      for (const row of issueCounts) {
        if (!row.projectId) continue;
        if (!countMap.has(row.projectId)) countMap.set(row.projectId, {});
        countMap.get(row.projectId)![row.status!] = row.count;
      }

      return projectList.map((p) => ({
        ...p,
        issueCounts: countMap.get(p.id) || {},
      }));
    },
  );

  // ── GET /:projectId — Get project detail ──────────────────────────────
  fastify.get<{ Params: { teamId: string; projectId: string } }>(
    '/:projectId',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { teamId, projectId } = request.params;

      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.teamId, teamId)))
        .limit(1);

      if (!project) {
        throw request.server.httpErrors.notFound('Project not found');
      }

      return project;
    },
  );

  // ── PUT /:projectId — Update project ──────────────────────────────────
  fastify.put<{ Params: { teamId: string; projectId: string } }>(
    '/:projectId',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { teamId, projectId } = request.params;
      const body = request.body as any;

      const updates: Record<string, any> = { updatedAt: new Date() };
      const fields = ['name', 'slug', 'description', 'color', 'icon', 'leadId', 'status', 'startDate', 'targetDate'];
      for (const f of fields) {
        if (body[f] !== undefined) updates[f] = body[f];
      }

      const [updated] = await db
        .update(projects)
        .set(updates)
        .where(and(eq(projects.id, projectId), eq(projects.teamId, teamId)))
        .returning();

      if (!updated) {
        throw request.server.httpErrors.notFound('Project not found');
      }

      return updated;
    },
  );

  // ── DELETE /:projectId — Delete project (admin+) ──────────────────────
  fastify.delete<{ Params: { teamId: string; projectId: string } }>(
    '/:projectId',
    { preHandler: [checkTeamAccess({ requireRole: 'admin' })] },
    async (request) => {
      const { teamId, projectId } = request.params;

      await db
        .delete(projects)
        .where(and(eq(projects.id, projectId), eq(projects.teamId, teamId)));

      return { success: true };
    },
  );

  // ── GET /:projectId/members — List project members ────────────────────
  fastify.get<{ Params: { teamId: string; projectId: string } }>(
    '/:projectId/members',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { projectId } = request.params;

      const rows = await db
        .select({
          id: projectMembers.id,
          userId: projectMembers.userId,
          role: projectMembers.role,
          assignedAt: projectMembers.assignedAt,
          name: profiles.name,
          email: profiles.email,
          avatarUrl: profiles.avatarUrl,
        })
        .from(projectMembers)
        .leftJoin(profiles, eq(projectMembers.userId, profiles.id))
        .where(eq(projectMembers.projectId, projectId));

      return rows;
    },
  );

  // ── POST /:projectId/members — Add project member ─────────────────────
  fastify.post<{ Params: { teamId: string; projectId: string } }>(
    '/:projectId/members',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { projectId } = request.params;
      const { userId, role } = request.body as { userId: string; role?: string };

      if (!userId) {
        return reply.status(400).send({ error: 'userId is required' });
      }

      const [member] = await db
        .insert(projectMembers)
        .values({
          projectId,
          userId,
          role: role || 'member',
          assignedBy: request.userId,
        })
        .onConflictDoNothing()
        .returning();

      if (!member) {
        return reply.status(409).send({ error: 'User is already a project member' });
      }

      return reply.status(201).send(member);
    },
  );

  // ── DELETE /:projectId/members/:userId — Remove project member ────────
  fastify.delete<{ Params: { teamId: string; projectId: string; userId: string } }>(
    '/:projectId/members/:userId',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { projectId, userId } = request.params;

      await db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, userId),
          ),
        );

      return { success: true };
    },
  );
};
