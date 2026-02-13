/**
 * User Routes — /api/users/*
 *
 * Ports delete-users Edge Function + user management.
 *
 * Endpoints:
 *   GET    /:userId  — Get user profile by ID
 *   PUT    /:userId  — Update user profile
 *   DELETE /:userId  — Admin delete user (requires app_role='admin')
 *   GET    /search   — Search users by email/name (for mentioning, assigning)
 *   GET    /ai-settings/me  — Get current user's AI settings
 *   PUT    /ai-settings/me  — Upsert current user's AI settings
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, and, or, sql, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import {
  users,
  profiles,
  userRoles,
  refreshTokens,
  notifications,
  activities,
  activityLogs,
  comments,
  conversations,
  messages,
  teamMembers,
  teamInvites,
  userAiSettings,
  conversationShares,
  conversationAccessRequests,
  prdDocuments,
  issues,
  blockComments,
  blockCommentReplies,
} from '../../db/schema.js';
import { requireAuth } from '../../plugins/auth.js';

// ─── Schemas ────────────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  timezone: z.string().optional(),
  preferredAiProvider: z.enum(['anthropic', 'openai', 'gemini', 'auto']).optional(),
  onboardingCompleted: z.boolean().optional(),
});

// ─── Plugin ──────────────────────────────────────────────────────────────────

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /:userId ── Get user profile ───────────────────────────────────────
  fastify.get<{
    Params: { userId: string };
  }>('/:userId', async (request, reply) => {
    requireAuth(request);

    const { userId } = request.params;

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    const [profile] = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        name: profiles.name,
        avatar_url: profiles.avatarUrl,
        timezone: profiles.timezone,
        preferred_ai_provider: profiles.preferredAiProvider,
        onboarding_completed: profiles.onboardingCompleted,
        created_at: profiles.createdAt,
        updated_at: profiles.updatedAt,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!profile) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return profile;
  });

  // ── PUT /:userId ── Update user profile ───────────────────────────────────
  fastify.put<{
    Params: { userId: string };
  }>('/:userId', async (request, reply) => {
    requireAuth(request);

    const { userId } = request.params;
    const body = updateProfileSchema.parse(request.body);

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;
    if (body.timezone !== undefined) updates.timezone = body.timezone;
    if (body.preferredAiProvider !== undefined) updates.preferredAiProvider = body.preferredAiProvider;
    if (body.onboardingCompleted !== undefined) updates.onboardingCompleted = body.onboardingCompleted;

    await db.update(profiles).set(updates).where(eq(profiles.id, userId));

    const [profile] = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        name: profiles.name,
        avatar_url: profiles.avatarUrl,
        timezone: profiles.timezone,
        preferred_ai_provider: profiles.preferredAiProvider,
        onboarding_completed: profiles.onboardingCompleted,
        created_at: profiles.createdAt,
        updated_at: profiles.updatedAt,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    return profile;
  });

  // ── DELETE /:userId ── Admin delete user ─────────────────────────────────
  fastify.delete<{
    Params: { userId: string };
  }>('/:userId', async (request, reply) => {
    requireAuth(request);

    const { userId: targetUserId } = request.params;

    if (!targetUserId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    // Verify the requesting user is an app admin
    const [adminRole] = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, request.userId),
          eq(userRoles.role, 'admin'),
        ),
      )
      .limit(1);

    // Also check for super_admin
    const [superAdminRole] = !adminRole
      ? await db
          .select({ role: userRoles.role })
          .from(userRoles)
          .where(
            and(
              eq(userRoles.userId, request.userId),
              eq(userRoles.role, 'super_admin'),
            ),
          )
          .limit(1)
      : [{ role: 'admin' as const }];

    if (!adminRole && !superAdminRole) {
      return reply
        .status(403)
        .send({ error: 'Only admins can delete users' });
    }

    // Verify target user exists
    const [targetUser] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Perform cascade delete in a transaction
    const details: string[] = [`User: ${targetUser.email}`];

    try {
      await db.transaction(async (tx) => {
        // Phase 1: Independent tables (parallel-safe within transaction)
        // Delete user AI settings
        await tx
          .delete(userAiSettings)
          .where(eq(userAiSettings.userId, targetUserId));
        details.push('user_ai_settings: ok');

        // Delete activity logs
        await tx
          .delete(activityLogs)
          .where(eq(activityLogs.userId, targetUserId));
        details.push('activity_logs: ok');

        // Delete notifications
        await tx
          .delete(notifications)
          .where(eq(notifications.userId, targetUserId));
        details.push('notifications: ok');

        // Delete block comment replies by user
        await tx
          .delete(blockCommentReplies)
          .where(eq(blockCommentReplies.userId, targetUserId));
        details.push('block_comment_replies: ok');

        // Delete block comments by user
        await tx
          .delete(blockComments)
          .where(eq(blockComments.userId, targetUserId));
        details.push('block_comments: ok');

        // Delete conversation access requests
        await tx
          .delete(conversationAccessRequests)
          .where(eq(conversationAccessRequests.requesterId, targetUserId));
        details.push('conversation_access_requests: ok');

        // Nullify responded_by references
        await tx
          .update(conversationAccessRequests)
          .set({ respondedBy: null })
          .where(eq(conversationAccessRequests.respondedBy, targetUserId));
        details.push('conversation_access_requests (responded_by nullify): ok');

        // Delete conversation shares
        await tx
          .delete(conversationShares)
          .where(eq(conversationShares.createdBy, targetUserId));
        details.push('conversation_shares: ok');

        // Nullify invite references
        await tx
          .update(teamInvites)
          .set({ invitedBy: null })
          .where(eq(teamInvites.invitedBy, targetUserId));
        details.push('team_invites (invited_by nullify): ok');

        // Nullify issue assignee/creator
        await tx
          .update(issues)
          .set({ assigneeId: null })
          .where(eq(issues.assigneeId, targetUserId));
        details.push('issues (assignee_id nullify): ok');

        await tx
          .update(issues)
          .set({ creatorId: null })
          .where(eq(issues.creatorId, targetUserId));
        details.push('issues (creator_id nullify): ok');

        // Phase 2: Dependent tables
        // Delete comments by user
        await tx.delete(comments).where(eq(comments.userId, targetUserId));
        details.push('comments: ok');

        // Delete activities by user
        await tx
          .delete(activities)
          .where(eq(activities.userId, targetUserId));
        details.push('activities: ok');

        // Delete PRD documents created by user
        await tx
          .delete(prdDocuments)
          .where(eq(prdDocuments.createdBy, targetUserId));
        details.push('prd_documents: ok');

        // Delete conversations (cascades to messages)
        await tx
          .delete(conversations)
          .where(eq(conversations.userId, targetUserId));
        details.push('conversations: ok');

        // Delete team memberships
        await tx
          .delete(teamMembers)
          .where(eq(teamMembers.userId, targetUserId));
        details.push('team_members: ok');

        // Delete invite records by email
        if (targetUser.email) {
          await tx
            .delete(teamInvites)
            .where(eq(teamInvites.email, targetUser.email));
          details.push('team_invites (by email): ok');
        }

        // Phase 3: Auth data
        // Delete refresh tokens
        await tx
          .delete(refreshTokens)
          .where(eq(refreshTokens.userId, targetUserId));
        details.push('refresh_tokens: ok');

        // Delete user roles
        await tx.delete(userRoles).where(eq(userRoles.userId, targetUserId));
        details.push('user_roles: ok');

        // Delete profile
        await tx.delete(profiles).where(eq(profiles.id, targetUserId));
        details.push('profiles: ok');

        // Delete user
        await tx.delete(users).where(eq(users.id, targetUserId));
        details.push('users: ok');
      });

      return {
        success: true,
        message: `User ${targetUser.email} deleted successfully`,
        details,
      };
    } catch (err: any) {
      request.log.error(err, 'Failed to delete user');
      return reply
        .status(500)
        .send({ error: 'Failed to delete user', details: err.message });
    }
  });

  // ── GET /search ── Search users by email/name ───────────────────────────
  fastify.get<{
    Querystring: { q?: string; teamId?: string };
  }>('/search', async (request, reply) => {
    requireAuth(request);

    const { q, teamId } = request.query as { q?: string; teamId?: string };

    if (!teamId) {
      return reply
        .status(400)
        .send({ error: 'teamId is required for user search' });
    }

    if (!q || q.trim().length === 0) {
      return reply
        .status(400)
        .send({ error: 'Search query (q) is required' });
    }

    const searchTerm = `%${q.trim()}%`;

    // Search team members whose profile name or email matches
    const results = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        fullName: profiles.fullName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .innerJoin(profiles, eq(teamMembers.userId, profiles.id))
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          or(
            ilike(profiles.name, searchTerm),
            ilike(profiles.email, searchTerm),
            ilike(profiles.fullName, searchTerm),
          ),
        ),
      )
      .limit(20);

    return { users: results };
  });

  // ── GET /ai-settings/me ── Get current user's AI settings ────────────────
  fastify.get('/ai-settings/me', async (request, reply) => {
    requireAuth(request);

    const [settings] = await db
      .select()
      .from(userAiSettings)
      .where(eq(userAiSettings.userId, request.userId))
      .limit(1);

    if (!settings) {
      return reply.send(null);
    }

    return reply.send(settings);
  });

  // ── PUT /ai-settings/me ── Upsert current user's AI settings ────────────
  fastify.put('/ai-settings/me', async (request, reply) => {
    requireAuth(request);

    const {
      anthropicApiKey,
      openaiApiKey,
      geminiApiKey,
      defaultProvider,
      autoModeEnabled,
    } = request.body as any;

    const updates: Record<string, any> = { userId: request.userId };
    if (anthropicApiKey !== undefined)
      updates.anthropicApiKey = anthropicApiKey;
    if (openaiApiKey !== undefined) updates.openaiApiKey = openaiApiKey;
    if (geminiApiKey !== undefined) updates.geminiApiKey = geminiApiKey;
    if (defaultProvider !== undefined) updates.defaultProvider = defaultProvider;
    if (autoModeEnabled !== undefined) updates.autoModeEnabled = autoModeEnabled;

    const [result] = await db
      .insert(userAiSettings)
      .values(updates)
      .onConflictDoUpdate({
        target: userAiSettings.userId,
        set: updates,
      })
      .returning();

    return reply.send(result);
  });
};
