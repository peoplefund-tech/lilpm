import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const FUNCTION_VERSION = '2026-02-05.1';

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
  targetUserId?: string; // Added for notification creation
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase URL and service role key from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const siteUrl = Deno.env.get('SITE_URL') || 'https://lilpmaiai.vercel.app';

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { inviteId, email, teamName, inviterName, role, token, targetUserId }: InviteEmailRequest = await req.json();

    console.log(`[${FUNCTION_VERSION}] Processing invite for ${email} (Target User: ${targetUserId || 'New User'})`);

    // 1. Create Notification (if existing user)
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
              inviteId: inviteId,
              teamId: null, // We don't have teamId readily available here without query, but inviteId/token is key
              teamName: teamName,
              inviterName: inviterName,
              role: role,
              token: token,
            },
          });

        if (notifError) {
          console.error('Failed to create inbox notification:', notifError);
        } else {
          console.log(`Inbox notification created for user ${targetUserId}`);
        }
      } catch (err) {
        console.error('Error creating notification:', err);
      }
    }

    // Create the invite link
    const inviteLink = `${siteUrl}/accept-invite/${token}`;

    // Send email using Supabase Auth Admin API
    const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        team_name: teamName,
        inviter_name: inviterName,
        role: role,
        invite_link: inviteLink,
      },
      redirectTo: inviteLink,
    });

    if (emailError) {
      console.error('Email send error:', emailError);

      // Try alternative method: Use raw email API
      const emailContent = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Lil PM</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #1f2937; margin-top: 0;">You've been invited to join a team!</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                <strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> on Lil PM as a <strong>${role}</strong>.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          display: inline-block;
                          font-weight: bold;">
                  Accept Invitation
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                Or copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: #667eea; word-break: break-all;">${inviteLink}</a>
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                This invitation was sent to ${email}. If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </div>
          </body>
        </html>
      `;

      // Use Resend API as fallback (if configured)
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Lil PM <noreply@lilpm.ai>',
            to: [email],
            subject: `${inviterName} invited you to join ${teamName} on Lil PM`,
            html: emailContent,
          }),
        });

        if (!resendResponse.ok) {
          const resendError = await resendResponse.text();
          console.error('Resend API error:', resendError);
          throw new Error('Failed to send invitation email');
        }

        console.log(`Invitation email sent via Resend to ${email}`);
      } else {
        // No email service configured, just log
        console.warn('No email service configured. Invitation created but email not sent.');
      }
    } else {
      console.log(`Invitation email sent successfully to ${email}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation email sent',
        version: FUNCTION_VERSION
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error sending team invite:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        version: FUNCTION_VERSION
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

