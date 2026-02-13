/**
 * Auth Routes — /api/auth/*
 *
 * Custom JWT-based auth replacing Supabase Auth.
 * Access token (15 min, HS256) + Refresh token (7 days, hash stored in DB+Redis).
 *
 * Endpoints:
 *   POST /signup           — Create account
 *   POST /login            — Email + password login
 *   POST /refresh          — Refresh access token
 *   POST /logout           — Revoke refresh token
 *   GET  /me               — Get current user profile
 *   PUT  /me               — Update profile (name, avatar)
 *   POST /forgot-password  — Send password reset email
 *   POST /reset-password   — Reset password with token
 *   POST /verify-email     — Verify email with token
 *   POST /change-password  — Change password (authenticated)
 *   DELETE /me             — Delete own account
 */

import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, refreshTokens, profiles, teamMembers, comments, activities, notifications, conversations } from '../../db/schema.js';
import { env } from '../../config/env.js';
import { requireAuth } from '../../plugins/auth.js';
import { sendEmail } from '../../services/email.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;
const BCRYPT_ROUNDS = 12;

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    algorithm: 'HS256',
  });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

// ─── Plugin ─────────────────────────────────────────────────────────────────

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /signup ────────────────────────────────────────────────────────
  fastify.post('/signup', { config: { skipAuth: true } }, async (request, reply) => {
    const body = signupSchema.parse(request.body);

    // Check email uniqueness
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1);

    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const [user] = await db.insert(users).values({
      email: body.email.toLowerCase(),
      passwordHash,
      emailVerifyToken,
    }).returning({ id: users.id, email: users.email });

    // Create profile
    await db.insert(profiles).values({
      id: user.id,
      name: body.name || body.email.split('@')[0],
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken();

    // Store refresh token hash
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });

    // Send verification email (fire-and-forget)
    const verifyUrl = `${env.SITE_URL}/verify-email?token=${emailVerifyToken}`;
    sendEmail(
      user.email,
      'Verify your email — Lil PM',
      `<h2>Welcome to Lil PM!</h2><p>Click <a href="${verifyUrl}">here</a> to verify your email.</p>`,
    ).catch((err) => request.log.error(err, 'Failed to send verification email'));

    return reply.status(201).send({
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken,
    });
  });

  // ── POST /login ─────────────────────────────────────────────────────────
  fastify.post('/login', { config: { skipAuth: true } }, async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    });

    // Fetch profile
    const [profile] = await db
      .select({ name: profiles.name, avatarUrl: profiles.avatarUrl })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: profile?.name,
        avatarUrl: profile?.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  });

  // ── POST /refresh ───────────────────────────────────────────────────────
  fastify.post('/refresh', { config: { skipAuth: true } }, async (request, reply) => {
    const { refreshToken: token } = request.body as { refreshToken?: string };
    if (!token) {
      return reply.status(400).send({ error: 'refreshToken is required' });
    }

    const tokenHash = hashToken(token);

    const [stored] = await db
      .select({
        id: refreshTokens.id,
        userId: refreshTokens.userId,
        expiresAt: refreshTokens.expiresAt,
      })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!stored || stored.expiresAt < new Date()) {
      // Delete expired token if found
      if (stored) {
        await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));
      }
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }

    // Get user
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, stored.userId))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    // Rotate: delete old, create new
    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

    const newRefreshToken = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(newRefreshToken),
      expiresAt,
    });

    return {
      accessToken: generateAccessToken(user.id, user.email),
      refreshToken: newRefreshToken,
    };
  });

  // ── POST /logout ────────────────────────────────────────────────────────
  fastify.post('/logout', async (request, reply) => {
    const { refreshToken: token } = request.body as { refreshToken?: string };

    if (token) {
      const tokenHash = hashToken(token);
      await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
    }

    return { success: true };
  });

  // ── GET /me ─────────────────────────────────────────────────────────────
  fastify.get('/me', async (request) => {
    requireAuth(request);

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    const [profile] = await db
      .select({ name: profiles.name, avatarUrl: profiles.avatarUrl })
      .from(profiles)
      .where(eq(profiles.id, request.userId))
      .limit(1);

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: profile?.name,
      avatarUrl: profile?.avatarUrl,
    };
  });

  // ── PUT /me ─────────────────────────────────────────────────────────────
  fastify.put('/me', async (request) => {
    requireAuth(request);
    const body = updateProfileSchema.parse(request.body);

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;

    await db.update(profiles).set(updates).where(eq(profiles.id, request.userId));

    const [profile] = await db
      .select({ name: profiles.name, avatarUrl: profiles.avatarUrl })
      .from(profiles)
      .where(eq(profiles.id, request.userId))
      .limit(1);

    return profile;
  });

  // ── POST /forgot-password ──────────────────────────────────────────────
  fastify.post('/forgot-password', { config: { skipAuth: true } }, async (request) => {
    const body = forgotPasswordSchema.parse(request.body);

    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1);

    // Always return success (don't reveal if email exists)
    if (!user) return { success: true };

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour

    await db.update(users).set({
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires,
    }).where(eq(users.id, user.id));

    const resetUrl = `${env.SITE_URL}/reset-password?token=${resetToken}`;
    sendEmail(
      user.email,
      'Reset your password — Lil PM',
      `<h2>Password Reset</h2><p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    ).catch((err) => console.error('Failed to send reset email:', err));

    return { success: true };
  });

  // ── POST /reset-password ──────────────────────────────────────────────
  fastify.post('/reset-password', { config: { skipAuth: true } }, async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        passwordResetExpires: users.passwordResetExpires,
      })
      .from(users)
      .where(eq(users.passwordResetToken, body.token))
      .limit(1);

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return reply.status(400).send({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    await db.update(users).set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    }).where(eq(users.id, user.id));

    // Revoke all refresh tokens (force re-login)
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));

    return { success: true };
  });

  // ── POST /verify-email ────────────────────────────────────────────────
  fastify.post('/verify-email', { config: { skipAuth: true } }, async (request, reply) => {
    const { token } = request.body as { token?: string };
    if (!token) {
      return reply.status(400).send({ error: 'token is required' });
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.emailVerifyToken, token))
      .limit(1);

    if (!user) {
      return reply.status(400).send({ error: 'Invalid verification token' });
    }

    await db.update(users).set({
      emailVerified: true,
      emailVerifyToken: null,
    }).where(eq(users.id, user.id));

    return { success: true };
  });

  // ── POST /change-password ─────────────────────────────────────────────
  fastify.post('/change-password', async (request, reply) => {
    requireAuth(request);
    const body = changePasswordSchema.parse(request.body);

    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, request.userId));

    return { success: true };
  });

  // ── DELETE /me ────────────────────────────────────────────────────────
  fastify.delete('/me', async (request) => {
    requireAuth(request);

    // Cascade delete: the DB constraints handle most, but clean up explicitly
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, request.userId));
    await db.delete(users).where(eq(users.id, request.userId));

    return { success: true };
  });
};
