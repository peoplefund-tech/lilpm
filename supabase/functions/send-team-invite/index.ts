import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const FUNCTION_VERSION = '2026-02-07.1'; // Fixed: Gmail SMTP for all users, no auto-registration

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteEmailRequest {
  inviteId: string;
  email: string;
  teamName: string;
  inviterName: string;
  role: string;
  token: string;
  targetUserId?: string;
}

// Generate beautiful HTML email template
function generateEmailHtml(inviterName: string, teamName: string, role: string, inviteLink: string, email: string): string {
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
              <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">You're Invited! 🎉</h2>
              
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

// Send email via Gmail SMTP
async function sendGmailEmail(
  gmailUser: string,
  gmailPassword: string,
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPassword,
        },
      },
    });

    await client.send({
      from: `Lil PM <${gmailUser}>`,
      to: to,
      subject: subject,
      html: htmlContent,
    });

    await client.close();
    return { success: true };
  } catch (error) {
    console.error('Gmail SMTP error:', error);
    return { success: false, error: (error as Error).message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const siteUrl = Deno.env.get('SITE_URL') || 'https://lilpmaiai.vercel.app';
    const gmailUser = Deno.env.get('GMAIL_USER');
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD');

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { inviteId, email, teamName, inviterName, role, token, targetUserId }: InviteEmailRequest = await req.json();

    console.log(`[${FUNCTION_VERSION}] Processing invite for ${email} (Target User: ${targetUserId || 'New User'})`);

    const inviteLink = `${siteUrl}/invite/accept?token=${token}`;
    let emailSent = false;
    let notificationCreated = false;

    // STEP 1: Create in-app notification for existing users
    if (targetUserId) {
      try {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: targetUserId,
            type: 'team_invite',
            title: `You've been invited to join ${teamName}`,
            message: `${inviterName} invited you to join ${teamName} as a ${role}`,
            data: {
              inviteId,
              teamName,
              inviterName,
              role,
              token,
              inviteLink,
            },
          });

        if (notifError) {
          console.error('Failed to create notification:', notifError);
        } else {
          notificationCreated = true;
          console.log(`Notification created for user ${targetUserId}`);
        }
      } catch (err) {
        console.error('Error creating notification:', err);
      }
    }

    // STEP 2: Send email
    if (targetUserId) {
      // Existing user: Send via Gmail SMTP
      if (gmailUser && gmailPassword) {
        console.log(`Sending email to existing user ${email} via Gmail SMTP`);

        const emailHtml = generateEmailHtml(inviterName, teamName, role, inviteLink, email);
        const subject = `${inviterName} invited you to join ${teamName} on Lil PM`;

        const result = await sendGmailEmail(gmailUser, gmailPassword, email, subject, emailHtml);

        if (result.success) {
          emailSent = true;
          console.log(`Email sent successfully to ${email} via Gmail`);
        } else {
          console.error('Gmail send failed:', result.error);
        }
      } else {
        console.log('Gmail credentials not configured - skipping email');
      }
    } else {
      // New user: Send invite via Gmail SMTP (NO auto-registration)
      // IMPORTANT: Do NOT use supabase.auth.admin.inviteUserByEmail() as it auto-creates users
      console.log(`Sending invite email to new user ${email} via Gmail SMTP`);

      if (gmailUser && gmailPassword) {
        const emailHtml = generateEmailHtml(inviterName, teamName, role, inviteLink, email);
        const subject = `${inviterName} invited you to join ${teamName} on Lil PM`;

        const result = await sendGmailEmail(gmailUser, gmailPassword, email, subject, emailHtml);
        if (result.success) {
          emailSent = true;
          console.log(`Invite email sent successfully to new user ${email}`);
        } else {
          console.error('Gmail send failed for new user:', result.error);
        }
      } else {
        console.error('Gmail credentials not configured - cannot send invite to new user');
        return new Response(
          JSON.stringify({
            error: 'Email service not configured. Please configure Gmail credentials.',
            version: FUNCTION_VERSION
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Build response message
    let message = '';
    if (emailSent && notificationCreated) {
      message = 'Invitation sent via email and in-app notification';
    } else if (emailSent) {
      message = 'Invitation email sent';
    } else if (notificationCreated) {
      message = 'Invitation created. User will receive notification when they log in.';
    } else {
      message = 'Invitation created but delivery pending';
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        notificationCreated,
        message,
        version: FUNCTION_VERSION
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending team invite:', error);
    return new Response(
      JSON.stringify({
        error: (error as Error).message || 'Internal server error',
        version: FUNCTION_VERSION
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
