/**
 * Block Comment Routes — /api/block-comments/*
 *
 * Handles inline comments on blocks within PRD and Issue editors.
 * Supports comments, replies, and reactions.
 *
 * Endpoints:
 *   GET    /                              — List block comments by page
 *   GET    /by-block                      — List comments for a specific block
 *   POST   /                              — Create comment
 *   PUT    /:commentId                    — Update comment (resolve/unresolve)
 *   DELETE /:commentId                    — Delete comment
 *   POST   /:commentId/replies            — Add reply to comment
 *   DELETE /:commentId/replies/:replyId   — Delete reply
 *   POST   /:commentId/reactions          — Toggle reaction on comment
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  blockComments,
  blockCommentReplies,
  profiles,
} from '../../db/schema.js';
import { requireAuth } from '../../plugins/auth.js';

// Helper to join comment with user, replies, and reactions
async function enrichComment(comment: any) {
  const replies = await db
    .select()
    .from(blockCommentReplies)
    .where(eq(blockCommentReplies.commentId, comment.id));

  const enrichedReplies = await Promise.all(
    replies.map(async (reply) => {
      const user = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, reply.userId))
        .then((rows) => rows[0]);
      return { ...reply, user };
    })
  );

  const user = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, comment.userId))
    .then((rows) => rows[0]);

  return {
    ...comment,
    user,
    replies: enrichedReplies,
    reactions: [], // Placeholder for future reactions implementation
  };
}

export const blockCommentRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET / — List comments by page ──────────────────────────────────────
  fastify.get<{ Querystring: { pageId?: string; pageType?: string } }>(
    '/',
    
    async (request) => {
      const { pageId, pageType } = request.query;

      if (!pageId || !pageType) {
        throw request.server.httpErrors.badRequest(
          'pageId and pageType are required'
        );
      }

      const comments = await db
        .select()
        .from(blockComments)
        .where(
          and(
            eq(blockComments.pageId, pageId),
            eq(blockComments.pageType, pageType)
          )
        )
        .orderBy(asc(blockComments.createdAt));

      // Enrich with replies and user data
      const enriched = await Promise.all(comments.map(enrichComment));
      return enriched;
    }
  );

  // ── GET /by-block — List comments for specific block ────────────────────
  fastify.get<{
    Querystring: { pageId?: string; pageType?: string; blockId?: string };
  }>(
    '/by-block',
    
    async (request) => {
      const { pageId, pageType, blockId } = request.query;

      if (!pageId || !pageType || !blockId) {
        throw request.server.httpErrors.badRequest(
          'pageId, pageType, and blockId are required'
        );
      }

      const comments = await db
        .select()
        .from(blockComments)
        .where(
          and(
            eq(blockComments.pageId, pageId),
            eq(blockComments.pageType, pageType),
            eq(blockComments.blockId, blockId)
          )
        )
        .orderBy(asc(blockComments.createdAt));

      // Enrich with replies and user data
      const enriched = await Promise.all(comments.map(enrichComment));
      return enriched;
    }
  );

  // ── POST / — Create comment ────────────────────────────────────────────
  fastify.post<{
    Body: {
      pageId: string;
      pageType: string;
      blockId: string;
      content: string;
    };
  }>(
    '/',
    
    async (request, reply) => {
      const { pageId, pageType, blockId, content } = request.body;

      if (!pageId || !pageType || !blockId || !content) {
        return reply.status(400).send({
          error: 'pageId, pageType, blockId, and content are required',
        });
      }

      const [comment] = await db
        .insert(blockComments)
        .values({
          pageId,
          pageType,
          blockId,
          userId: request.userId,
          content,
          resolved: false,
        })
        .returning();

      const enriched = await enrichComment(comment);
      return reply.status(201).send(enriched);
    }
  );

  // ── PUT /:commentId — Update comment (resolve/unresolve) ───────────────
  fastify.put<{
    Params: { commentId: string };
    Body: { resolved?: boolean };
  }>(
    '/:commentId',
    
    async (request) => {
      const { commentId } = request.params;
      const { resolved } = request.body;

      const updates: Record<string, any> = {};
      if (resolved !== undefined) {
        updates.resolved = resolved;
        if (resolved) {
          updates.resolvedBy = request.userId;
          updates.resolvedAt = new Date().toISOString();
        } else {
          updates.resolvedBy = null;
          updates.resolvedAt = null;
        }
      }

      const [updated] = await db
        .update(blockComments)
        .set(updates)
        .where(eq(blockComments.id, commentId))
        .returning();

      if (!updated) {
        throw request.server.httpErrors.notFound('Comment not found');
      }

      const enriched = await enrichComment(updated);
      return enriched;
    }
  );

  // ── DELETE /:commentId — Delete comment ────────────────────────────────
  fastify.delete<{ Params: { commentId: string } }>(
    '/:commentId',
    
    async (request) => {
      const { commentId } = request.params;

      await db.delete(blockComments).where(eq(blockComments.id, commentId));

      return { success: true };
    }
  );

  // ── POST /:commentId/replies — Add reply to comment ────────────────────
  fastify.post<{
    Params: { commentId: string };
    Body: { content: string };
  }>(
    '/:commentId/replies',
    
    async (request, reply) => {
      const { commentId } = request.params;
      const { content } = request.body;

      if (!content) {
        return reply.status(400).send({ error: 'content is required' });
      }

      // Verify comment exists
      const comment = await db
        .select()
        .from(blockComments)
        .where(eq(blockComments.id, commentId))
        .then((rows) => rows[0]);

      if (!comment) {
        throw request.server.httpErrors.notFound('Comment not found');
      }

      const [newReply] = await db
        .insert(blockCommentReplies)
        .values({
          commentId,
          userId: request.userId,
          content,
        })
        .returning();

      const user = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, newReply.userId))
        .then((rows) => rows[0]);

      return reply.status(201).send({ ...newReply, user });
    }
  );

  // ── DELETE /:commentId/replies/:replyId — Delete reply ────────────────
  fastify.delete<{
    Params: { commentId: string; replyId: string };
  }>(
    '/:commentId/replies/:replyId',
    
    async (request) => {
      const { replyId } = request.params;

      await db.delete(blockCommentReplies).where(eq(blockCommentReplies.id, replyId));

      return { success: true };
    }
  );

  // ── DELETE /reply/:replyId — Delete reply (without commentId in path) ───
  fastify.delete<{
    Params: { replyId: string };
  }>(
    '/reply/:replyId',
    
    async (request) => {
      const { replyId } = request.params;

      await db.delete(blockCommentReplies).where(eq(blockCommentReplies.id, replyId));

      return { success: true };
    }
  );

  // ── POST /:commentId/reactions — Toggle reaction on comment ─────────────
  // Note: Full reactions table not yet implemented in schema
  // This endpoint is a placeholder for future implementation
  fastify.post<{
    Params: { commentId: string };
    Body: { emoji: string };
  }>(
    '/:commentId/reactions',
    
    async (request, reply) => {
      const { commentId } = request.params;
      const { emoji } = request.body;

      if (!emoji) {
        return reply
          .status(400)
          .send({ error: 'emoji is required' });
      }

      // TODO: Implement once block_comment_reactions table is added to schema
      return reply.status(501).send({
        error: 'Reactions feature not yet implemented',
      });
    }
  );
};
