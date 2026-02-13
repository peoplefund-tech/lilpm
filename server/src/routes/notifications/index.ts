/**
 * Notification Routes — /api/notifications/*
 *
 * Ports send-notification-email Edge Function + notifications CRUD.
 *
 * Endpoints:
 *   GET    /                — List user's notifications (paginated, newest first)
 *   PATCH  /:id/read        — Mark a single notification as read
 *   POST   /read-all        — Mark all notifications as read (optionally scoped by teamId)
 *   POST   /send-email      — Internal: send notification email
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { notifications, profiles } from '../../db/schema.js';
import { requireAuth } from '../../plugins/auth.js';
import { sendEmail } from '../../services/email.js';
import { env } from '../../config/env.js';

// ─── Notification Types ──────────────────────────────────────────────────────

type NotificationType =
  | 'issue_assigned'
  | 'issue_mentioned'
  | 'comment_added'
  | 'invite_received'
  | 'member_joined'
  | 'member_removed'
  | 'prd_updated';

interface NotificationEmailData {
  actorName?: string;
  entityTitle?: string;
  entityId?: string;
  entityType?: 'issue' | 'prd' | 'project';
  teamName?: string;
  message?: string;
  comment?: string;
}

const NOTIFICATION_CONFIG: Record<
  NotificationType,
  { subject: string; emoji: string; title: string; gradient: string }
> = {
  issue_assigned: {
    subject: 'New issue assigned to you',
    emoji: '📋',
    title: 'Issue Assigned',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  },
  issue_mentioned: {
    subject: 'You were mentioned in an issue',
    emoji: '📝',
    title: 'Mentioned in Issue',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  },
  comment_added: {
    subject: 'New comment on your issue',
    emoji: '💬',
    title: 'New Comment',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
  },
  invite_received: {
    subject: 'You have a new team invitation',
    emoji: '👥',
    title: 'Team Invitation',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  },
  member_joined: {
    subject: 'New team member joined',
    emoji: '🎉',
    title: 'New Team Member',
    gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
  },
  member_removed: {
    subject: 'Team membership update',
    emoji: '👋',
    title: 'Member Removed',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  },
  prd_updated: {
    subject: 'A PRD you follow was updated',
    emoji: '📄',
    title: 'PRD Updated',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  },
};

// ─── Email Template ──────────────────────────────────────────────────────────

function generateNotificationEmailHtml(
  type: NotificationType,
  data: NotificationEmailData,
  recipientEmail: string,
): string {
  const config = NOTIFICATION_CONFIG[type];
  const entityLink = data.entityId
    ? `${env.SITE_URL}/${data.entityType || 'issue'}/${data.entityId}`
    : `${env.SITE_URL}/dashboard`;

  const messageText =
    data.message || 'You have a new notification.';

  const entitySection = data.entityTitle
    ? `
              <div style="background-color: #f0fdfa; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border-left: 4px solid #0891b2;">
                <p style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">${(data.entityType || 'item').toUpperCase()}</p>
                <p style="color: #18181b; font-size: 18px; font-weight: 600; margin: 0;">${data.entityTitle}</p>
              </div>`
    : '';

  const commentSection = data.comment
    ? `
              <div style="background-color: #fafafa; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border-left: 4px solid #a1a1aa;">
                <p style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Comment</p>
                <p style="color: #3f3f46; font-size: 14px; line-height: 1.6; margin: 0;">${data.comment}</p>
              </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: ${config.gradient}; padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Lil PM</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">${config.title}</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">${config.emoji} ${config.title}</h2>
              <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                ${data.actorName ? `<strong style="color: #6366f1;">${data.actorName}</strong> ` : ''}${messageText}
              </p>
              ${entitySection}
              ${commentSection}
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${entityLink}"
                   style="display: inline-block; background: ${config.gradient};
                          color: #ffffff; text-decoration: none; padding: 16px 48px;
                          border-radius: 8px; font-size: 16px; font-weight: 600;
                          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                  View Details
                </a>
              </div>
              <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0;">
                Or copy and paste this link:<br>
                <a href="${entityLink}" style="color: #6366f1; word-break: break-all;">${entityLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #e4e4e7;">
              <p style="color: #a1a1aa; font-size: 12px; margin: 0; text-align: center;">
                This email was sent to ${recipientEmail}.<br>
                <a href="${env.SITE_URL}/settings" style="color: #6366f1;">Manage notification preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET / ── List user's notifications ──────────────────────────────────
  fastify.get<{
    Querystring: {
      teamId?: string;
      limit?: string;
      offset?: string;
      unreadOnly?: string;
    };
  }>('/', async (request) => {
    requireAuth(request);

    const {
      teamId,
      limit: limitStr = '50',
      offset: offsetStr = '0',
      unreadOnly,
    } = request.query as {
      teamId?: string;
      limit?: string;
      offset?: string;
      unreadOnly?: string;
    };

    const limit = Math.min(parseInt(limitStr, 10) || 50, 100);
    const offset = parseInt(offsetStr, 10) || 0;

    const conditions = [eq(notifications.userId, request.userId)];

    if (unreadOnly === 'true') {
      conditions.push(eq(notifications.read, false));
    }

    // If teamId provided, filter by data->teamId
    // Using raw SQL for JSONB field filter
    const baseQuery = db
      .select()
      .from(notifications)
      .where(
        teamId
          ? and(
              ...conditions,
              sql`${notifications.data}->>'teamId' = ${teamId}`,
            )
          : and(...conditions),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const rows = await baseQuery;

    // Get total unread count
    const [unreadCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, request.userId),
          eq(notifications.read, false),
        ),
      );

    return {
      notifications: rows,
      unreadCount: unreadCount?.count || 0,
      limit,
      offset,
    };
  });

  // ── PATCH /:id/read ── Mark single notification as read ─────────────────
  fastify.patch<{
    Params: { id: string };
  }>('/:id/read', async (request, reply) => {
    requireAuth(request);

    const { id } = request.params;

    const [updated] = await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(eq(notifications.id, id), eq(notifications.userId, request.userId)),
      )
      .returning({ id: notifications.id });

    if (!updated) {
      return reply.status(404).send({ error: 'Notification not found' });
    }

    return { success: true, id: updated.id };
  });

  // ── POST /read-all ── Mark all notifications as read ────────────────────
  fastify.post<{
    Querystring: { teamId?: string };
  }>('/read-all', async (request) => {
    requireAuth(request);

    const { teamId } = request.query as { teamId?: string };

    const conditions = [
      eq(notifications.userId, request.userId),
      eq(notifications.read, false),
    ];

    if (teamId) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            ...conditions,
            sql`${notifications.data}->>'teamId' = ${teamId}`,
          ),
        );
    } else {
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(...conditions));
    }

    return { success: true };
  });

  // ── POST /send-email ── Internal: send notification email ───────────────
  fastify.post<{
    Body: {
      userId: string;
      type: NotificationType;
      data: NotificationEmailData;
    };
  }>('/send-email', async (request, reply) => {
    requireAuth(request);

    const { userId, type, data } = request.body as {
      userId: string;
      type: NotificationType;
      data: NotificationEmailData;
    };

    if (!userId || !type) {
      return reply
        .status(400)
        .send({ error: 'userId and type are required' });
    }

    const config = NOTIFICATION_CONFIG[type];
    if (!config) {
      return reply
        .status(400)
        .send({ error: `Unknown notification type: ${type}` });
    }

    // Look up user's email
    const [profile] = await db
      .select({ email: profiles.email, name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!profile?.email) {
      return reply
        .status(404)
        .send({ error: 'User not found or has no email' });
    }

    const emailHtml = generateNotificationEmailHtml(
      type,
      data,
      profile.email,
    );
    const subject = data.actorName
      ? `${data.actorName}: ${config.subject}`
      : config.subject;

    const emailResult = await sendEmail(profile.email, subject, emailHtml);

    return {
      success: true,
      emailSent: emailResult.success,
      type,
      message: emailResult.success
        ? 'Notification email sent'
        : 'Email skipped (no email service configured)',
    };
  });
};
