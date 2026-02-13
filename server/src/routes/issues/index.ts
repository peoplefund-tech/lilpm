/**
 * Issue Routes — /api/teams/:teamId/issues/*
 *
 * Endpoints:
 *   POST   /                          — Create issue
 *   GET    /                          — List issues (with filters: archived, projectId, status, priority, assigneeId, cycleId, search, sort, order, limit, offset)
 *   GET    /:issueId                  — Get issue detail
 *   PUT    /:issueId                  — Update issue (including archivedAt for archive/unarchive)
 *   DELETE /:issueId                  — Delete issue (permanent delete)
 *   POST   /:issueId/comments         — Add comment
 *   GET    /:issueId/comments         — List comments
 *   GET    /:issueId/activities        — List activities
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, and, sql, desc, asc, like, or, isNull, isNotNull, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  issues,
  teams,
  profiles,
  issueLabels,
  labels,
  comments,
  activities,
} from '../../db/schema.js';
import { requireAuth } from '../../plugins/auth.js';
import { checkTeamAccess } from '../../plugins/team-access.js';

export const issueRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST / — Create issue ─────────────────────────────────────────────
  fastify.post<{ Params: { teamId: string } }>(
    '/',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { teamId } = request.params;
      const body = request.body as any;

      if (!body.title) {
        return reply.status(400).send({ error: 'title is required' });
      }

      // Auto-generate identifier: increment team issue count atomically
      const [teamRow] = await db
        .update(teams)
        .set({ issueCount: sql`${teams.issueCount} + 1` })
        .where(eq(teams.id, teamId))
        .returning({ issueCount: teams.issueCount, issuePrefix: teams.issuePrefix });

      const identifier = `${teamRow.issuePrefix}-${teamRow.issueCount}`;

      const [issue] = await db
        .insert(issues)
        .values({
          teamId,
          projectId: body.projectId || null,
          cycleId: body.cycleId || null,
          parentId: body.parentId || null,
          prdId: body.prdId || null,
          identifier,
          title: body.title,
          description: body.description || null,
          status: body.status || 'backlog',
          priority: body.priority || 'none',
          assigneeId: body.assigneeId || null,
          creatorId: request.userId,
          estimate: body.estimate || null,
          dueDate: body.dueDate || null,
          startDate: body.startDate || null,
          sortOrder: body.sortOrder ?? 0,
        })
        .returning();

      // Create activity record
      await db.insert(activities).values({
        issueId: issue.id,
        userId: request.userId,
        type: 'issue_created',
        data: { title: body.title },
      });

      // Attach labels if provided
      if (body.labelIds && Array.isArray(body.labelIds) && body.labelIds.length > 0) {
        await db.insert(issueLabels).values(
          body.labelIds.map((labelId: string) => ({
            issueId: issue.id,
            labelId,
          })),
        );
      }

      return reply.status(201).send(issue);
    },
  );

  // ── GET / — List issues with filters ──────────────────────────────────
  fastify.get<{ Params: { teamId: string }; Querystring: Record<string, string> }>(
    '/',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { teamId } = request.params;
      const {
        projectId,
        status,
        priority,
        assigneeId,
        cycleId,
        search,
        archived,
        sort = 'createdAt',
        order = 'desc',
        limit: limitStr = '50',
        offset: offsetStr = '0',
      } = request.query as any;

      const limit = Math.min(parseInt(limitStr, 10) || 50, 200);
      const offset = parseInt(offsetStr, 10) || 0;

      // Build conditions
      const conditions: any[] = [eq(issues.teamId, teamId)];

      // Handle archived filter
      if (archived === 'true') {
        conditions.push(isNotNull(issues.archivedAt));
      } else if (archived !== 'all') {
        // Default: exclude archived items
        conditions.push(isNull(issues.archivedAt));
      }

      if (projectId) conditions.push(eq(issues.projectId, projectId));
      if (status) conditions.push(eq(issues.status, status));
      if (priority) conditions.push(eq(issues.priority, priority));
      if (assigneeId) {
        if (assigneeId === 'unassigned') {
          conditions.push(isNull(issues.assigneeId));
        } else {
          conditions.push(eq(issues.assigneeId, assigneeId));
        }
      }
      if (cycleId) conditions.push(eq(issues.cycleId, cycleId));
      if (search) {
        conditions.push(
          or(
            like(issues.title, `%${search}%`),
            like(issues.identifier, `%${search}%`),
          ),
        );
      }

      // Sort mapping
      const sortColumnMap: Record<string, any> = {
        createdAt: issues.createdAt,
        updatedAt: issues.updatedAt,
        priority: issues.priority,
        status: issues.status,
        title: issues.title,
        sortOrder: issues.sortOrder,
        dueDate: issues.dueDate,
      };
      const sortColumn = sortColumnMap[sort] || issues.createdAt;
      const orderFn = order === 'asc' ? asc : desc;

      const rows = await db
        .select({
          issue: issues,
          assigneeName: profiles.name,
          assigneeAvatar: profiles.avatarUrl,
        })
        .from(issues)
        .leftJoin(profiles, eq(issues.assigneeId, profiles.id))
        .where(and(...conditions))
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(and(...conditions));

      return {
        data: rows.map((r) => ({
          ...r.issue,
          assignee: r.assigneeName
            ? { name: r.assigneeName, avatarUrl: r.assigneeAvatar }
            : null,
        })),
        total: countResult.count,
        limit,
        offset,
      };
    },
  );

  // ── GET /:issueId — Get issue detail ──────────────────────────────────
  fastify.get<{ Params: { teamId: string; issueId: string } }>(
    '/:issueId',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { teamId, issueId } = request.params;

      const [row] = await db
        .select()
        .from(issues)
        .where(and(eq(issues.id, issueId), eq(issues.teamId, teamId)))
        .limit(1);

      if (!row) {
        throw request.server.httpErrors.notFound('Issue not found');
      }

      // Fetch labels
      const issueLabelRows = await db
        .select({
          labelId: labels.id,
          name: labels.name,
          color: labels.color,
        })
        .from(issueLabels)
        .innerJoin(labels, eq(issueLabels.labelId, labels.id))
        .where(eq(issueLabels.issueId, issueId));

      // Fetch assignee + creator profiles
      const profileIds = [row.assigneeId, row.creatorId].filter(Boolean) as string[];
      let profileMap: Record<string, any> = {};
      if (profileIds.length > 0) {
        const profileRows = await db
          .select({ id: profiles.id, name: profiles.name, avatarUrl: profiles.avatarUrl, email: profiles.email })
          .from(profiles)
          .where(inArray(profiles.id, profileIds));
        for (const p of profileRows) {
          profileMap[p.id] = p;
        }
      }

      return {
        ...row,
        labels: issueLabelRows,
        assignee: row.assigneeId ? profileMap[row.assigneeId] || null : null,
        creator: row.creatorId ? profileMap[row.creatorId] || null : null,
      };
    },
  );

  // ── PUT /:issueId — Update issue ──────────────────────────────────────
  fastify.put<{ Params: { teamId: string; issueId: string } }>(
    '/:issueId',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { teamId, issueId } = request.params;
      const body = request.body as any;

      // Fetch current for diffing
      const [current] = await db
        .select()
        .from(issues)
        .where(and(eq(issues.id, issueId), eq(issues.teamId, teamId)))
        .limit(1);

      if (!current) {
        throw request.server.httpErrors.notFound('Issue not found');
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      const trackFields = [
        'title', 'description', 'status', 'priority', 'assigneeId',
        'projectId', 'cycleId', 'parentId', 'prdId', 'estimate',
        'dueDate', 'startDate', 'sortOrder', 'archivedAt',
      ];
      for (const f of trackFields) {
        if (body[f] !== undefined) updates[f] = body[f];
      }

      const [updated] = await db
        .update(issues)
        .set(updates)
        .where(and(eq(issues.id, issueId), eq(issues.teamId, teamId)))
        .returning();

      // Create activity records for tracked changes
      const activityRecords: any[] = [];

      if (body.status !== undefined && body.status !== current.status) {
        activityRecords.push({
          issueId,
          userId: request.userId,
          type: 'status_changed' as const,
          data: { from: current.status, to: body.status },
        });
      }
      if (body.priority !== undefined && body.priority !== current.priority) {
        activityRecords.push({
          issueId,
          userId: request.userId,
          type: 'priority_changed' as const,
          data: { from: current.priority, to: body.priority },
        });
      }
      if (body.assigneeId !== undefined && body.assigneeId !== current.assigneeId) {
        activityRecords.push({
          issueId,
          userId: request.userId,
          type: 'assignee_changed' as const,
          data: { from: current.assigneeId, to: body.assigneeId },
        });
      }
      if (activityRecords.length === 0 && Object.keys(updates).length > 1) {
        // Generic update activity
        activityRecords.push({
          issueId,
          userId: request.userId,
          type: 'issue_updated' as const,
          data: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
        });
      }

      if (activityRecords.length > 0) {
        await db.insert(activities).values(activityRecords);
      }

      return updated;
    },
  );

  // ── DELETE /:issueId — Delete issue ───────────────────────────────────
  fastify.delete<{ Params: { teamId: string; issueId: string } }>(
    '/:issueId',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { teamId, issueId } = request.params;

      await db
        .delete(issues)
        .where(and(eq(issues.id, issueId), eq(issues.teamId, teamId)));

      return { success: true };
    },
  );

  // ── POST /:issueId/comments — Add comment ────────────────────────────
  fastify.post<{ Params: { teamId: string; issueId: string } }>(
    '/:issueId/comments',
    { preHandler: [checkTeamAccess()] },
    async (request, reply) => {
      const { issueId } = request.params;
      const { body: commentBody } = request.body as { body: string };

      if (!commentBody) {
        return reply.status(400).send({ error: 'body is required' });
      }

      const [comment] = await db
        .insert(comments)
        .values({
          issueId,
          userId: request.userId,
          body: commentBody,
        })
        .returning();

      // Activity record
      await db.insert(activities).values({
        issueId,
        userId: request.userId,
        type: 'comment_added',
        data: { commentId: comment.id },
      });

      return reply.status(201).send(comment);
    },
  );

  // ── GET /:issueId/comments — List comments ────────────────────────────
  fastify.get<{ Params: { teamId: string; issueId: string } }>(
    '/:issueId/comments',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { issueId } = request.params;

      const rows = await db
        .select({
          comment: comments,
          userName: profiles.name,
          userAvatar: profiles.avatarUrl,
        })
        .from(comments)
        .leftJoin(profiles, eq(comments.userId, profiles.id))
        .where(eq(comments.issueId, issueId))
        .orderBy(asc(comments.createdAt));

      return rows.map((r) => ({
        ...r.comment,
        user: { name: r.userName, avatarUrl: r.userAvatar },
      }));
    },
  );

  // ── GET /:issueId/activities — List activities ────────────────────────
  fastify.get<{ Params: { teamId: string; issueId: string } }>(
    '/:issueId/activities',
    { preHandler: [checkTeamAccess()] },
    async (request) => {
      const { issueId } = request.params;

      const rows = await db
        .select({
          activity: activities,
          userName: profiles.name,
          userAvatar: profiles.avatarUrl,
        })
        .from(activities)
        .leftJoin(profiles, eq(activities.userId, profiles.id))
        .where(eq(activities.issueId, issueId))
        .orderBy(desc(activities.createdAt));

      return rows.map((r) => ({
        ...r.activity,
        user: { name: r.userName, avatarUrl: r.userAvatar },
      }));
    },
  );
};
