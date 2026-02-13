/**
 * Invite Routes — /api/invites/*
 *
 * Ports send-team-invite, accept-invite-v2, get-invite-preview Edge Functions.
 *
 * Endpoints:
 *   POST /send     — Send a team invite (requires team admin+)
 *   POST /accept   — Accept an invite (authenticated or preview)
 *   POST /preview  — Get invite preview (no auth required)
 */

import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  teamInvites,
  teams,
  teamMembers,
  profiles,
  notifications,
} from '../../db/schema.js';
import { requireAuth } from '../../plugins/auth.js';
import { checkTeamAccess } from '../../plugins/team-access.js';
import { sendEmail } from '../../services/email.js';
import { env } from '../../config/env.js';

// ─── Email Template ──────────────────────────────────────────────────────────

function generateInviteEmailHtml(
  inviterName: string,
  teamName: string,
  role: string,
  inviteLink: string,
  email: string,
): string {
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
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Lil PM</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">Project Management Made Simple</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">You're Invited!</h2>
              <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                <strong style="color: #6366f1;">${inviterName}</strong> has invited you to join
                <strong style="color: #18181b;">${teamName}</strong> as a <strong>${role}</strong>.
              </p>
              <!-- Team Info Box -->
              <div style="background-color: #fafafa; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border-left: 4px solid #6366f1;">
                <p style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Team</p>
                <p style="color: #18181b; font-size: 18px; font-weight: 600; margin: 0;">${teamName}</p>
              </div>
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${inviteLink}"
                   style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                          color: #ffffff; text-decoration: none; padding: 16px 48px;
                          border-radius: 8px; font-size: 16px; font-weight: 600;
                          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                  Accept Invitation
                </a>
              </div>
              <!-- Link fallback -->
              <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0;">
                Or copy and paste this link:<br>
                <a href="${inviteLink}" style="color: #6366f1; word-break: break-all;">${inviteLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #e4e4e7;">
              <p style="color: #a1a1aa; font-size: 12px; margin: 0; text-align: center;">
                This email was sent to ${email}.<br>
                If you weren't expecting this invitation, you can safely ignore it.
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

export const inviteRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET / ── List pending invites for a team ───────────────────────────
  fastify.get<{
    Querystring: { teamId?: string };
  }>('/', async (request, reply) => {
    requireAuth(request);

    const { teamId } = request.query as { teamId?: string };

    if (!teamId) {
      return reply.status(400).send({ error: 'teamId is required' });
    }

    // Check that the current user is a member of this team
    const [membership] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, request.userId),
        ),
      )
      .limit(1);

    if (!membership) {
      return reply
        .status(403)
        .send({ error: 'You are not a member of this team' });
    }

    const invites = await db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.teamId, teamId),
          eq(teamInvites.status, 'pending'),
        ),
      )
      .orderBy(teamInvites.createdAt);

    return invites;
  });

  // ── POST /send ── Send team invite ──────────────────────────────────────
  fastify.post<{
    Body: { teamId: string; email: string; role?: string; projectIds?: string[] };
  }>('/send', async (request, reply) => {
    requireAuth(request);

    const { teamId, email, role = 'member', projectIds } = request.body as {
      teamId: string;
      email: string;
      role?: string;
      projectIds?: string[];
    };

    if (!teamId || !email) {
      return reply.status(400).send({ error: 'teamId and email are required' });
    }

    // Check that the current user is admin+ on this team
    const [membership] = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, request.userId),
        ),
      )
      .limit(1);

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return reply
        .status(403)
        .send({ error: 'Only team owners and admins can send invites' });
    }

    // Get team name
    const [team] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return reply.status(404).send({ error: 'Team not found' });
    }

    // Get inviter profile
    const [inviterProfile] = await db
      .select({ name: profiles.name, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, request.userId))
      .limit(1);

    const inviterName =
      inviterProfile?.name || inviterProfile?.email || 'A team member';

    // Check if already a member
    const [existingProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, email.toLowerCase()))
      .limit(1);

    if (existingProfile) {
      const [existingMember] = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, existingProfile.id),
          ),
        )
        .limit(1);

      if (existingMember) {
        return reply
          .status(409)
          .send({ error: 'User is already a member of this team' });
      }
    }

    // Create invite token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const [invite] = await db
      .insert(teamInvites)
      .values({
        teamId,
        email: email.toLowerCase(),
        role: role as 'owner' | 'admin' | 'member' | 'guest',
        invitedBy: request.userId,
        token,
        expiresAt,
      })
      .returning({
        id: teamInvites.id,
        email: teamInvites.email,
        role: teamInvites.role,
        status: teamInvites.status,
        token: teamInvites.token,
        createdAt: teamInvites.createdAt,
        teamId: teamInvites.teamId,
      });

    // Create notification for the inviter activity
    await db.insert(notifications).values({
      userId: request.userId,
      type: 'invite_sent',
      title: `Invitation sent to ${email}`,
      message: `You invited ${email} to join ${team.name} as ${role}`,
      data: { inviteId: invite.id, teamId, email, role },
    });

    // If the target user already exists, create a notification for them
    if (existingProfile) {
      await db.insert(notifications).values({
        userId: existingProfile.id,
        type: 'team_invite',
        title: `You've been invited to join ${team.name}`,
        message: `${inviterName} invited you to join ${team.name} as a ${role}`,
        data: {
          inviteId: invite.id,
          teamName: team.name,
          inviterName,
          role,
          token,
        },
      });
    }

    // Send invite email
    const inviteLink = `${env.SITE_URL}/invite?token=${token}`;
    const emailHtml = generateInviteEmailHtml(
      inviterName,
      team.name,
      role,
      inviteLink,
      email,
    );
    const subject = `${inviterName} invited you to join ${team.name} on Lil PM`;

    const emailResult = await sendEmail(email, subject, emailHtml);

    return {
      ...invite,
      isExistingUser: !!existingProfile,
      emailSent: emailResult.success,
    };
  });

  // ── POST /accept ── Accept an invite ────────────────────────────────────
  fastify.post<{
    Body: { token: string };
  }>('/accept', async (request, reply) => {
    const { token } = request.body as { token: string };

    if (!token) {
      return reply.status(400).send({ error: 'token is required' });
    }

    // Look up the invite
    const [invite] = await db
      .select({
        id: teamInvites.id,
        teamId: teamInvites.teamId,
        email: teamInvites.email,
        role: teamInvites.role,
        status: teamInvites.status,
        expiresAt: teamInvites.expiresAt,
        invitedBy: teamInvites.invitedBy,
      })
      .from(teamInvites)
      .where(eq(teamInvites.token, token))
      .limit(1);

    if (!invite) {
      return reply
        .status(404)
        .send({ error: 'Invitation not found or expired' });
    }

    if (invite.status === 'cancelled') {
      return reply
        .status(400)
        .send({ error: 'This invitation has been cancelled' });
    }

    if (invite.status === 'accepted') {
      return reply
        .status(400)
        .send({ error: 'This invitation has already been accepted' });
    }

    if (invite.status !== 'pending') {
      return reply
        .status(400)
        .send({ error: `Invalid invite status: ${invite.status}` });
    }

    // Check expiry
    if (invite.expiresAt < new Date()) {
      return reply
        .status(400)
        .send({ error: 'This invitation has expired' });
    }

    // Get team name
    const [team] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, invite.teamId))
      .limit(1);

    const teamName = team?.name || 'Unknown Team';

    // If not authenticated, return info so frontend can redirect
    if (!request.userId) {
      return {
        requiresAuth: true,
        email: invite.email,
        teamName,
        teamId: invite.teamId,
        role: invite.role,
      };
    }

    // Authenticated: accept the invite
    // Add to team_members
    try {
      await db.insert(teamMembers).values({
        teamId: invite.teamId,
        userId: request.userId,
        role: invite.role,
      });
    } catch (err: any) {
      // Unique constraint violation = already a member
      if (err.code === '23505') {
        request.log.info('User is already a team member');
      } else {
        throw err;
      }
    }

    // Update invite status
    await db
      .update(teamInvites)
      .set({ status: 'accepted' })
      .where(eq(teamInvites.id, invite.id));

    // Create notification for the new member
    await db.insert(notifications).values({
      userId: request.userId,
      type: 'team_joined',
      title: `You joined ${teamName}`,
      message: `You are now a ${invite.role} of ${teamName}`,
      data: { teamId: invite.teamId, teamName },
    });

    // Notify the inviter
    if (invite.invitedBy) {
      const [newMemberProfile] = await db
        .select({ name: profiles.name, email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, request.userId))
        .limit(1);

      const newMemberName =
        newMemberProfile?.name || newMemberProfile?.email || 'A new member';

      await db.insert(notifications).values({
        userId: invite.invitedBy,
        type: 'member_joined',
        title: `${newMemberName} joined ${teamName}`,
        message: `${newMemberName} accepted your invitation and joined ${teamName}`,
        data: {
          teamId: invite.teamId,
          teamName,
          newMemberId: request.userId,
          newMemberName,
        },
      });
    }

    return {
      success: true,
      action: 'accepted',
      teamId: invite.teamId,
      teamName,
    };
  });

  // ── POST /preview ── Get invite preview (no auth) ───────────────────────
  fastify.post<{
    Body: { token: string };
  }>(
    '/preview',
    { config: { skipAuth: true } },
    async (request, reply) => {
      const { token } = request.body as { token: string };

      if (!token) {
        return reply.status(400).send({ error: 'token is required' });
      }

      // Look up the invite with team and inviter info
      const [invite] = await db
        .select({
          id: teamInvites.id,
          status: teamInvites.status,
          expiresAt: teamInvites.expiresAt,
          email: teamInvites.email,
          role: teamInvites.role,
          teamId: teamInvites.teamId,
          teamName: teams.name,
          inviterName: profiles.name,
          inviterAvatar: profiles.avatarUrl,
        })
        .from(teamInvites)
        .leftJoin(teams, eq(teamInvites.teamId, teams.id))
        .leftJoin(profiles, eq(teamInvites.invitedBy, profiles.id))
        .where(eq(teamInvites.token, token))
        .limit(1);

      if (!invite) {
        return { valid: false, status: 'not_found' };
      }

      const baseInfo = {
        teamName: invite.teamName,
        inviterName: invite.inviterName,
        inviterAvatar: invite.inviterAvatar,
        email: invite.email,
        role: invite.role,
      };

      // Check if expired
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        return { valid: false, status: 'expired', ...baseInfo };
      }

      // Check status
      if (invite.status !== 'pending') {
        return { valid: false, status: invite.status, ...baseInfo };
      }

      return {
        valid: true,
        status: 'pending',
        teamId: invite.teamId,
        ...baseInfo,
      };
    },
  );

  // ── PUT /:inviteId/cancel ── Cancel an invite ──────────────────────────
  fastify.put<{
    Params: { inviteId: string };
  }>('/:inviteId/cancel', async (request, reply) => {
    requireAuth(request);

    const { inviteId } = request.params as { inviteId: string };

    // Get the invite first
    const [invite] = await db
      .select({
        id: teamInvites.id,
        teamId: teamInvites.teamId,
        email: teamInvites.email,
        status: teamInvites.status,
      })
      .from(teamInvites)
      .where(eq(teamInvites.id, inviteId))
      .limit(1);

    if (!invite) {
      return reply.status(404).send({ error: 'Invite not found' });
    }

    // Check that the current user is admin+ on this team
    const [membership] = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, invite.teamId),
          eq(teamMembers.userId, request.userId),
        ),
      )
      .limit(1);

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return reply
        .status(403)
        .send({ error: 'Only team owners and admins can cancel invites' });
    }

    // Update invite status
    await db
      .update(teamInvites)
      .set({ status: 'cancelled' })
      .where(eq(teamInvites.id, inviteId));

    return { success: true, message: 'Invite cancelled' };
  });

  // ── POST /check ── Check invite validity ───────────────────────────────
  fastify.post<{
    Body: { token: string };
  }>(
    '/check',
    { config: { skipAuth: true } },
    async (request, reply) => {
      const { token } = request.body as { token: string };

      if (!token) {
        return reply.status(400).send({ error: 'token is required' });
      }

      try {
        const [invite] = await db
          .select({ status: teamInvites.status, expiresAt: teamInvites.expiresAt })
          .from(teamInvites)
          .where(eq(teamInvites.token, token))
          .limit(1);

        if (!invite) {
          return { valid: false, status: 'not_found' };
        }

        if (invite.expiresAt && invite.expiresAt < new Date()) {
          return { valid: false, status: 'expired' };
        }

        if (invite.status !== 'pending') {
          return { valid: false, status: invite.status };
        }

        return { valid: true, status: 'pending' };
      } catch (error) {
        return { valid: false, status: 'not_found' };
      }
    },
  );

  // ── POST /reject ── Reject an invite ───────────────────────────────────
  fastify.post<{
    Body: { token: string };
  }>('/reject', async (request, reply) => {
    requireAuth(request);

    const { token } = request.body as { token: string };

    if (!token) {
      return reply.status(400).send({ error: 'token is required' });
    }

    // Look up the invite
    const [invite] = await db
      .select({
        id: teamInvites.id,
        teamId: teamInvites.teamId,
        email: teamInvites.email,
        status: teamInvites.status,
        invitedBy: teamInvites.invitedBy,
      })
      .from(teamInvites)
      .where(and(eq(teamInvites.token, token), eq(teamInvites.status, 'pending')))
      .limit(1);

    if (!invite) {
      return reply
        .status(404)
        .send({ error: 'Invite not found or expired' });
    }

    // Update invite status
    await db
      .update(teamInvites)
      .set({ status: 'rejected' })
      .where(eq(teamInvites.id, invite.id));

    // Get team info for notification
    const [team] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, invite.teamId))
      .limit(1);

    const teamName = team?.name || 'Unknown Team';

    // Get rejecter profile for notification
    const [rejecterProfile] = await db
      .select({ name: profiles.name, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, request.userId))
      .limit(1);

    const rejecterName =
      rejecterProfile?.name || rejecterProfile?.email || 'A user';

    // Create notification for inviter
    if (invite.invitedBy) {
      await db.insert(notifications).values({
        userId: invite.invitedBy,
        type: 'invite_rejected',
        title: `${rejecterName} declined your invitation`,
        message: `${rejecterName} declined to join ${teamName}`,
        data: {
          teamId: invite.teamId,
          teamName,
          rejectedBy: request.userId,
        },
      });
    }

    return { success: true, message: 'Invite rejected' };
  });
};
