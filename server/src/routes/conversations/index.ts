/**
 * Conversation Routes — /api/conversations/*
 *
 * Endpoints:
 *   POST   /:teamId/conversations              — Create conversation
 *   GET    /:teamId/conversations              — List team conversations
 *   GET    /conversations                      — List personal conversations
 *   GET    /conversations/:conversationId      — Get conversation detail
 *   PUT    /conversations/:conversationId      — Update conversation
 *   DELETE /conversations/:conversationId      — Delete conversation
 *   GET    /conversations/:conversationId/messages — Get messages
 *   POST   /conversations/:conversationId/messages — Create message
 *   POST   /conversations/:conversationId/share    — Create share link
 *   DELETE /conversations/:conversationId/share/:shareId — Revoke share
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { conversations, messages, teamMembers, conversationShares } from '../../db/schema.js';
import { requireAuth } from '../../plugins/auth.js';
import { checkTeamAccess } from '../../plugins/team-access.js';
import { randomBytes } from 'crypto';

export const conversationRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /:teamId/conversations — Create conversation ─────────────────
  fastify.post('/:teamId/conversations', async (request, reply) => {
    requireAuth(request);
    const { teamId } = request.params as { teamId: string };
    const { projectId, title, aiProvider } = request.body as any;

    await checkTeamAccess(request.userId, teamId, 'guest');

    const [conversation] = await db.insert(conversations).values({
      userId: request.userId,
      teamId,
      projectId: projectId || null,
      title: title || null,
      aiProvider: aiProvider || 'anthropic',
    }).returning();

    return reply.status(201).send(conversation);
  });

  // ── GET /:teamId/conversations — List team conversations ──────────────
  fastify.get('/:teamId/conversations', async (request, reply) => {
    requireAuth(request);
    const { teamId } = request.params as { teamId: string };

    await checkTeamAccess(request.userId, teamId, 'guest');

    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.teamId, teamId))
      .orderBy(desc(conversations.updatedAt));

    return reply.send(rows);
  });

  // ── GET /conversations — List personal conversations ──────────────────
  fastify.get('/conversations', async (request, reply) => {
    requireAuth(request);

    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, request.userId))
      .orderBy(desc(conversations.updatedAt));

    return reply.send(rows);
  });

  // ── GET /conversations/:conversationId — Get conversation detail ──────
  fastify.get('/conversations/:conversationId', async (request, reply) => {
    requireAuth(request);
    const { conversationId } = request.params as { conversationId: string };

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    await checkTeamAccess(request.userId, conversation.teamId, 'guest');

    return reply.send(conversation);
  });

  // ── PUT /conversations/:conversationId — Update conversation ──────────
  fastify.put('/conversations/:conversationId', async (request, reply) => {
    requireAuth(request);
    const { conversationId } = request.params as { conversationId: string };
    const updates = request.body as any;

    const [existing] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    // Only owner or team members can update
    if (existing.userId !== request.userId) {
      await checkTeamAccess(request.userId, existing.teamId, 'member');
    }

    const [updated] = await db
      .update(conversations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return reply.send(updated);
  });

  // ── DELETE /conversations/:conversationId — Delete conversation ───────
  fastify.delete('/conversations/:conversationId', async (request, reply) => {
    requireAuth(request);
    const { conversationId } = request.params as { conversationId: string };

    const [existing] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    // Only owner can delete
    if (existing.userId !== request.userId) {
      return reply.status(403).send({ error: 'Only conversation owner can delete' });
    }

    await db.delete(conversations).where(eq(conversations.id, conversationId));

    return reply.status(204).send();
  });

  // ── GET /conversations/:conversationId/messages — Get messages ────────
  fastify.get('/conversations/:conversationId/messages', async (request, reply) => {
    requireAuth(request);
    const { conversationId } = request.params as { conversationId: string };
    const { limit, context } = request.query as { limit?: string; context?: string };

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    await checkTeamAccess(request.userId, conversation.teamId, 'guest');

    let query = db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    // If context=true, order descending for last N messages (to be reversed on client)
    // Otherwise, order ascending for chronological display
    if (context === 'true') {
      query = query.orderBy(desc(messages.createdAt));
    } else {
      query = query.orderBy(asc(messages.createdAt));
    }

    if (limit) {
      query = query.limit(parseInt(limit, 10));
    }

    const rows = await query;
    return reply.send(rows);
  });

  // ── POST /conversations/:conversationId/messages — Create message ─────
  fastify.post('/conversations/:conversationId/messages', async (request, reply) => {
    requireAuth(request);
    const { conversationId } = request.params as { conversationId: string };
    const { role, content, metadata, tokensUsed, aiProvider } = request.body as any;

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    await checkTeamAccess(request.userId, conversation.teamId, 'guest');

    if (!role || !content) {
      return reply.status(400).send({ error: 'role and content are required' });
    }

    const [message] = await db.insert(messages).values({
      conversationId,
      role,
      content,
      metadata: metadata || {},
      tokensUsed: tokensUsed || null,
      aiProvider: aiProvider || null,
    }).returning();

    // Update conversation updatedAt
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    return reply.status(201).send(message);
  });

  // ── POST /conversations/:conversationId/share — Create share link ─────────
  fastify.post('/conversations/:conversationId/share', async (request, reply) => {
    requireAuth(request);
    const { conversationId } = request.params as { conversationId: string };
    const { accessLevel, expiresAt } = request.body as any;

    // Get conversation to verify access
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    // Only owner can create shares
    if (conversation.userId !== request.userId) {
      return reply.status(403).send({ error: 'Only conversation owner can create shares' });
    }

    // Generate unique share token
    const shareToken = randomBytes(16).toString('hex');

    const [share] = await db
      .insert(conversationShares)
      .values({
        conversationId,
        shareToken,
        createdBy: request.userId,
        accessLevel: accessLevel || 'view',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    return reply.status(201).send({
      id: share.id,
      shareToken: share.shareToken,
      accessLevel: share.accessLevel,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
    });
  });

  // ── DELETE /conversations/:conversationId/share/:shareId — Revoke share ────
  fastify.delete(
    '/conversations/:conversationId/share/:shareId',
    async (request, reply) => {
      requireAuth(request);
      const { conversationId, shareId } = request.params as {
        conversationId: string;
        shareId: string;
      };

      // Get conversation to verify owner
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      if (conversation.userId !== request.userId) {
        return reply.status(403).send({ error: 'Only conversation owner can revoke shares' });
      }

      // Verify share belongs to this conversation
      const [share] = await db
        .select()
        .from(conversationShares)
        .where(
          and(eq(conversationShares.id, shareId), eq(conversationShares.conversationId, conversationId))
        )
        .limit(1);

      if (!share) {
        return reply.status(404).send({ error: 'Share not found' });
      }

      await db.delete(conversationShares).where(eq(conversationShares.id, shareId));

      return reply.status(204).send();
    }
  );
};
