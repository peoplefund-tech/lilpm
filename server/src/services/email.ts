/**
 * Email Service — nodemailer (Gmail SMTP) + Resend API fallback
 *
 * Port of supabase/functions/_shared/email.ts from Deno denomailer to Node.js nodemailer.
 */

import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// ─── Gmail SMTP Transport ───────────────────────────────────────────────────

let gmailTransport: nodemailer.Transporter | null = null;

function getGmailTransport(): nodemailer.Transporter | null {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) return null;

  if (!gmailTransport) {
    gmailTransport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return gmailTransport;
}

// ─── Resend API fallback ────────────────────────────────────────────────────

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Lil PM <noreply@${env.SITE_URL.replace(/https?:\/\//, '')}>`,
        to,
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      return { success: false, error: `Resend ${resp.status}: ${body}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface EmailResult {
  success: boolean;
  provider?: 'gmail' | 'resend';
  error?: string;
}

/**
 * Send an HTML email with automatic fallback:
 *   1. Try Gmail SMTP (if configured)
 *   2. Fall back to Resend API
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<EmailResult> {
  // 1. Try Gmail
  const gmail = getGmailTransport();
  if (gmail) {
    try {
      await gmail.sendMail({
        from: `"Lil PM" <${env.GMAIL_USER}>`,
        to,
        subject,
        html,
      });
      return { success: true, provider: 'gmail' };
    } catch (err) {
      console.warn('[Email] Gmail failed, trying Resend fallback:', (err as Error).message);
    }
  }

  // 2. Try Resend
  const resendResult = await sendViaResend(to, subject, html);
  if (resendResult.success) {
    return { success: true, provider: 'resend' };
  }

  // Both failed
  return {
    success: false,
    error: resendResult.error || 'No email provider configured',
  };
}
