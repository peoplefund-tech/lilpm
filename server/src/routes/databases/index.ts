/**
 * Database Routes — /api/databases/*
 *
 * Endpoints:
 *   POST   /:teamId/databases              — Create database
 *   GET    /:teamId/databases              — List team databases
 *   GET    /databases/:databaseId          — Get database detail
 *   PUT    /databases/:databaseId          — Update database
 *   DELETE /databases/:databaseId          — Delete database
 *   GET    /databases/:databaseId/rows     — Get database rows
 *   POST   /databases/:databaseId/rows     — Create database row
 *   PUT    /databases/rows/:rowId          — Update database row
 *   DELETE /databases/rows/:rowId          — Delete database row
 *   GET    /databases/:databaseId/properties — Get database properties
 *   POST   /databases/:databaseId/properties — Create database property
 *   PUT    /databases/properties/:propertyId — Update database property
 *   DELETE /databases/properties/:propertyId — Delete database property
 *   GET    /databases/:databaseId/views    — Get database views
 *   POST   /databases/:databaseId/views    — Create database view
 *   PUT    /databases/views/:viewId        — Update database view
 *   DELETE /databases/views/:viewId        — Delete database view
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { databases, databaseProperties, databaseRows, databaseViews } from '../../db/schema.js';
import { requireAuth } from '../../plugins/auth.js';
import { checkTeamAccess } from '../../plugins/team-access.js';

export const databaseRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /:teamId/databases — Create database ─────────────────────────
  fastify.post('/:teamId/databases', async (request, reply) => {
    requireAuth(request);
    const { teamId } = request.params as { teamId: string };
    const { name, description, icon, coverUrl } = request.body as any;

    await checkTeamAccess(request.userId, teamId, 'member');

    if (!name) {
      return reply.status(400).send({ error: 'name is required' });
    }

    const [database] = await db.insert(databases).values({
      teamId,
      name,
      description: description || null,
      icon: icon || null,
      coverUrl: coverUrl || null,
      createdBy: request.userId,
    }).returning();

    return reply.status(201).send(database);
  });

  // ── GET /:teamId/databases — List team databases ──────────────────────
  fastify.get('/:teamId/databases', async (request, reply) => {
    requireAuth(request);
    const { teamId } = request.params as { teamId: string };

    await checkTeamAccess(request.userId, teamId, 'guest');

    const rows = await db
      .select()
      .from(databases)
      .where(eq(databases.teamId, teamId))
      .orderBy(desc(databases.createdAt));

    return reply.send(rows);
  });

  // ── GET /databases/:databaseId — Get database detail ──────────────────
  fastify.get('/databases/:databaseId', async (request, reply) => {
    requireAuth(request);
    const { databaseId } = request.params as { databaseId: string };

    const [database] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, databaseId))
      .limit(1);

    if (!database) {
      return reply.status(404).send({ error: 'Database not found' });
    }

    await checkTeamAccess(request.userId, database.teamId, 'guest');

    return reply.send(database);
  });

  // ── PUT /databases/:databaseId — Update database ──────────────────────
  fastify.put('/databases/:databaseId', async (request, reply) => {
    requireAuth(request);
    const { databaseId } = request.params as { databaseId: string };
    const updates = request.body as any;

    const [existing] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, databaseId))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Database not found' });
    }

    await checkTeamAccess(request.userId, existing.teamId, 'member');

    const [updated] = await db
      .update(databases)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(databases.id, databaseId))
      .returning();

    return reply.send(updated);
  });

  // ── DELETE /databases/:databaseId — Delete database ───────────────────
  fastify.delete('/databases/:databaseId', async (request, reply) => {
    requireAuth(request);
    const { databaseId } = request.params as { databaseId: string };

    const [existing] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, databaseId))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Database not found' });
    }

    await checkTeamAccess(request.userId, existing.teamId, 'admin');

    await db.delete(databases).where(eq(databases.id, databaseId));

    return reply.status(204).send();
  });

  // ── GET /databases/:databaseId/rows — Get database rows ───────────────
  fastify.get('/databases/:databaseId/rows', async (request, reply) => {
    requireAuth(request);
    const { databaseId } = request.params as { databaseId: string };

    const [database] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, databaseId))
      .limit(1);

    if (!database) {
      return reply.status(404).send({ error: 'Database not found' });
    }

    await checkTeamAccess(request.userId, database.teamId, 'guest');

    const rows = await db
      .select()
      .from(databaseRows)
      .where(eq(databaseRows.databaseId, databaseId))
      .orderBy(desc(databaseRows.createdAt));

    return reply.send(rows);
  });

  // ── POST /databases/:databaseId/rows — Create database row ────────────
  fastify.post('/databases/:databaseId/rows', async (request, reply) => {
    requireAuth(request);
    const { databaseId } = request.params as { databaseId: string };
    const { properties } = request.body as any;

    const [database] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, databaseId))
      .limit(1);

    if (!database) {
      return reply.status(404).send({ error: 'Database not found' });
    }

    await checkTeamAccess(request.userId, database.teamId, 'member');

    const [row] = await db.insert(databaseRows).values({
      databaseId,
      properties: properties || {},
      createdBy: request.userId,
    }).returning();

    return reply.status(201).send(row);
  });

  // ── PUT /databases/rows/:rowId — Update database row ──────────────────
  fastify.put('/databases/rows/:rowId', async (request, reply) => {
    requireAuth(request);
    const { rowId } = request.params as { rowId: string };
    const { properties } = request.body as any;

    const [existing] = await db
      .select({
        row: databaseRows,
        teamId: databases.teamId,
      })
      .from(databaseRows)
      .innerJoin(databases, eq(databaseRows.databaseId, databases.id))
      .where(eq(databaseRows.id, rowId))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Database row not found' });
    }

    await checkTeamAccess(request.userId, existing.teamId, 'member');

    const [updated] = await db
      .update(databaseRows)
      .set({
        properties: properties || existing.row.properties,
        updatedAt: new Date(),
      })
      .where(eq(databaseRows.id, rowId))
      .returning();

    return reply.send(updated);
  });

  // ── DELETE /databases/rows/:rowId — Delete database row ───────────────
  fastify.delete('/databases/rows/:rowId', async (request, reply) => {
    requireAuth(request);
    const { rowId } = request.params as { rowId: string };

    const [existing] = await db
      .select({
        row: databaseRows,
        teamId: databases.teamId,
      })
      .from(databaseRows)
      .innerJoin(databases, eq(databaseRows.databaseId, databases.id))
      .where(eq(databaseRows.id, rowId))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Database row not found' });
    }

    await checkTeamAccess(request.userId, existing.teamId, 'member');

    await db.delete(databaseRows).where(eq(databaseRows.id, rowId));

    return reply.status(204).send();
  });

  // ── GET /databases/:databaseId/properties — Get properties ────────────
  fastify.get('/databases/:databaseId/properties', async (request, reply) => {
    requireAuth(request);
    const { databaseId } = request.params as { databaseId: string };

    const [database] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, databaseId))
      .limit(1);

    if (!database) {
      return reply.status(404).send({ error: 'Database not found' });
    }

    await checkTeamAccess(request.userId, database.teamId, 'guest');

    const rows = await db
      .select()
      .from(databaseProperties)
      .where(eq(databaseProperties.databaseId, databaseId))
      .orderBy(databaseProperties.position);

    return reply.send(rows);
  });

  // ── POST /databases/:databaseId/properties — Create property ──────────
  fastify.post('/databases/:databaseId/properties', async (request, reply) => {
    requireAuth(request);
    const { databaseId } = request.params as { databaseId: string };
    const { name, type, config, position } = request.body as any;

    const [database] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, databaseId))
      .limit(1);

    if (!database) {
      return reply.status(404).send({ error: 'Database not found' });
    }

    await checkTeamAccess(request.userId, database.teamId, 'member');

    if (!name || !type) {
      return reply.status(400).send({ error: 'name and type are required' });
    }

    const [property] = await db.insert(databaseProperties).values({
      databaseId,
      name,
      type,
      config: config || {},
      position: position || 0,
    }).returning();

    return reply.status(201).send(property);
  });

  // ── PUT /databases/properties/:propertyId — Update property ───────────
  fastify.put('/databases/properties/:propertyId', async (request, reply) => {
    requireAuth(request);
    const { propertyId } = request.params as { propertyId: string };
    const updates = request.body as any;

    const [existing] = await db
      .select({
        property: databaseProperties,
        teamId: databases.teamId,
      })
      .from(databaseProperties)
      .innerJoin(databases, eq(databaseProperties.databaseId, databases.id))
      .where(eq(databaseProperties.id, propertyId))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Database property not found' });
    }

    await checkTeamAccess(request.userId, existing.teamId, 'member');

    const [updated] = await db
      .update(databaseProperties)
      .set(updates)
      .where(eq(databaseProperties.id, propertyId))
      .returning();

    return reply.send(updated);
  });

  // ── DELETE /databases/properties/:propertyId — Delete property ────────
  fastify.delete('/databases/properties/:propertyId', async (request, reply) => {
    requireAuth(request);
    const { propertyId } = request.params as { propertyId: string };

    const [existing] = await db
      .select({
        property: databaseProperties,
        teamId: databases.teamId,
      })
      .from(databaseProperties)
      .innerJoin(databases, eq(databaseProperties.databaseId, databases.id))
      .where(eq(databaseProperties.id, propertyId))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Database property not found' });
    }

    await checkTeamAccess(request.userId, existing.teamId, 'member');

    await db.delete(databaseProperties).where(eq(databaseProperties.id, propertyId));

    return reply.status(204).send();
  });

  // ── GET /databases/:databaseId/views — Get views ──────────────────────
  fastify.get('/databases/:databaseId/views', async (request, reply) => {
    requireAuth(request);
    const { databaseId } = request.params as { databaseId: string };

    const [database] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, databaseId))
      .limit(1);

    if (!database) {
      return reply.status(404).send({ error: 'Database not found' });
    }

    await checkTeamAccess(request.userId, database.teamId, 'guest');

    const rows = await db
      .select()
      .from(databaseViews)
      .where(eq(databaseViews.databaseId, databaseId))
      .orderBy(databaseViews.position);

    return reply.send(rows);
  });

  // ── POST /databases/:databaseId/views — Create view ───────────────────
  fastify.post('/databases/:databaseId/views', async (request, reply) => {
    requireAuth(request);
    const { databaseId } = request.params as { databaseId: string };
    const { name, type, config, position } = request.body as any;

    const [database] = await db
      .select()
      .from(databases)
      .where(eq(databases.id, databaseId))
      .limit(1);

    if (!database) {
      return reply.status(404).send({ error: 'Database not found' });
    }

    await checkTeamAccess(request.userId, database.teamId, 'member');

    if (!name) {
      return reply.status(400).send({ error: 'name is required' });
    }

    const [view] = await db.insert(databaseViews).values({
      databaseId,
      name,
      type: type || 'table',
      config: config || {},
      position: position || 0,
    }).returning();

    return reply.status(201).send(view);
  });

  // ── PUT /databases/views/:viewId — Update view ────────────────────────
  fastify.put('/databases/views/:viewId', async (request, reply) => {
    requireAuth(request);
    const { viewId } = request.params as { viewId: string };
    const updates = request.body as any;

    const [existing] = await db
      .select({
        view: databaseViews,
        teamId: databases.teamId,
      })
      .from(databaseViews)
      .innerJoin(databases, eq(databaseViews.databaseId, databases.id))
      .where(eq(databaseViews.id, viewId))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Database view not found' });
    }

    await checkTeamAccess(request.userId, existing.teamId, 'member');

    const [updated] = await db
      .update(databaseViews)
      .set(updates)
      .where(eq(databaseViews.id, viewId))
      .returning();

    return reply.send(updated);
  });

  // ── DELETE /databases/views/:viewId — Delete view ─────────────────────
  fastify.delete('/databases/views/:viewId', async (request, reply) => {
    requireAuth(request);
    const { viewId } = request.params as { viewId: string };

    const [existing] = await db
      .select({
        view: databaseViews,
        teamId: databases.teamId,
      })
      .from(databaseViews)
      .innerJoin(databases, eq(databaseViews.databaseId, databases.id))
      .where(eq(databaseViews.id, viewId))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Database view not found' });
    }

    await checkTeamAccess(request.userId, existing.teamId, 'member');

    await db.delete(databaseViews).where(eq(databaseViews.id, viewId));

    return reply.status(204).send();
  });
};
