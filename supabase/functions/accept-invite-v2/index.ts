import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const FUNCTION_VERSION = '2026-02-08.1';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AcceptInviteRequest {
    token: string;
    userId?: string; // Optional - if provided, user is already authenticated
}

interface AcceptInviteResponse {
    success: boolean;
    action: 'accepted' | 'needs_auth' | 'needs_signup' | 'error';
    teamId?: string;
    teamName?: string;
    userExists?: boolean;
    email?: string;
    magicLinkSent?: boolean;
    error?: string;
    version: string;
}

// Generate Magic Link email HTML
function generateMagicLinkEmailHtml(teamName: string, magicLink: string, email: string): string {
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
              <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 14px;">Join Your Team</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Join ${teamName} 🚀</h2>
              
              <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Click the button below to join <strong style="color: #18181b;">${teamName}</strong>. 
                This link will log you in automatically.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${magicLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); 
                          color: #ffffff; text-decoration: none; padding: 16px 48px; 
                          border-radius: 8px; font-size: 16px; font-weight: 600;
                          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                  Join Team Now
                </a>
              </div>
              
              <!-- Link fallback -->
              <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0;">
                Or copy and paste this link:<br>
                <a href="${magicLink}" style="color: #6366f1; word-break: break-all;">${magicLink}</a>
              </p>
              
              <p style="color: #ef4444; font-size: 13px; margin: 16px 0 0 0;">
                ⚠️ This link expires in 1 hour and can only be used once.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #e4e4e7;">
              <p style="color: #a1a1aa; font-size: 12px; margin: 0; text-align: center;">
                This email was sent to ${email}.<br>
                If you weren't expecting this, you can safely ignore it.
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

        // Create admin client with service role for bypassing RLS
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { token, userId }: AcceptInviteRequest = await req.json();

        console.log(`[${FUNCTION_VERSION}] Processing invite acceptance for token: ${token.substring(0, 8)}...`);

        // STEP 1: Validate invite token (service role bypasses RLS)
        const { data: invite, error: inviteError } = await supabaseAdmin
            .from('team_invites')
            .select('*, teams(id, name)')
            .eq('token', token)
            .single();

        if (inviteError || !invite) {
            console.error('Invite lookup failed:', inviteError);
            return new Response(
                JSON.stringify({
                    success: false,
                    action: 'error',
                    error: 'Invitation not found or expired',
                    version: FUNCTION_VERSION
                } as AcceptInviteResponse),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check invite status
        if (invite.status === 'cancelled') {
            return new Response(
                JSON.stringify({
                    success: false,
                    action: 'error',
                    error: 'This invitation has been cancelled',
                    version: FUNCTION_VERSION
                } as AcceptInviteResponse),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (invite.status === 'accepted') {
            return new Response(
                JSON.stringify({
                    success: false,
                    action: 'error',
                    error: 'This invitation has already been accepted',
                    version: FUNCTION_VERSION
                } as AcceptInviteResponse),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check expiry (24 hours from creation)
        const createdAt = new Date(invite.created_at);
        const now = new Date();
        const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceCreated > 24) {
            return new Response(
                JSON.stringify({
                    success: false,
                    action: 'error',
                    error: 'This invitation has expired (valid for 24 hours)',
                    version: FUNCTION_VERSION
                } as AcceptInviteResponse),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const teamId = invite.team_id;
        const teamName = invite.teams?.name || 'Unknown Team';
        const inviteEmail = invite.email;

        // STEP 2: Check if user exists by email (using service role)
        const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .eq('email', inviteEmail)
            .maybeSingle();

        const userExists = !!existingProfile;

        // STEP 3: Handle based on authentication state

        // CASE A: User provided userId (authenticated) - Accept immediately
        if (userId) {
            console.log(`User ${userId} is authenticated, accepting invite directly`);

            // Add user to team
            const { error: memberError } = await supabaseAdmin
                .from('team_members')
                .insert({
                    team_id: teamId,
                    user_id: userId,
                    role: invite.role || 'member',
                });

            if (memberError) {
                // Check if already a member
                if (memberError.code === '23505') {
                    console.log('User is already a team member');
                } else {
                    console.error('Failed to add team member:', memberError);
                    return new Response(
                        JSON.stringify({
                            success: false,
                            action: 'error',
                            error: 'Failed to join team',
                            version: FUNCTION_VERSION
                        } as AcceptInviteResponse),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
            }

            // Mark invite as accepted
            await supabaseAdmin
                .from('team_invites')
                .update({ status: 'accepted' })
                .eq('id', invite.id);

            // STEP 4: Send notification emails to inviter and existing team members
            if (gmailUser && gmailPassword) {
                try {
                    // Get the new member's profile
                    const { data: newMemberProfile } = await supabaseAdmin
                        .from('profiles')
                        .select('name, email')
                        .eq('id', userId)
                        .single();

                    const newMemberName = newMemberProfile?.name || newMemberProfile?.email || 'A new member';

                    // Get all existing team members (except the new member)
                    const { data: teamMembers } = await supabaseAdmin
                        .from('team_members')
                        .select('user_id, profiles(email, name)')
                        .eq('team_id', teamId)
                        .neq('user_id', userId);

                    // Generate notification email HTML
                    const notificationHtml = `
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
          <tr>
            <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🎉 New Team Member!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">${newMemberName} joined ${teamName}</h2>
              <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Great news! <strong style="color: #18181b;">${newMemberName}</strong> has accepted the invitation and joined <strong style="color: #18181b;">${teamName}</strong>.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${Deno.env.get('SITE_URL') || 'https://lilpmaiai.vercel.app'}/dashboard" 
                   style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); 
                          color: #ffffff; text-decoration: none; padding: 16px 48px; 
                          border-radius: 8px; font-size: 16px; font-weight: 600;
                          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                  Go to Dashboard
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #e4e4e7;">
              <p style="color: #a1a1aa; font-size: 12px; margin: 0; text-align: center;">
                You received this email because you're a member of ${teamName}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

                    // Send email to each team member
                    for (const member of (teamMembers || [])) {
                        const memberEmail = (member.profiles as any)?.email;
                        if (memberEmail) {
                            await sendGmailEmail(
                                gmailUser,
                                gmailPassword,
                                memberEmail,
                                `🎉 ${newMemberName} joined ${teamName}!`,
                                notificationHtml
                            );
                            console.log(`Notification email sent to ${memberEmail}`);
                        }
                    }
                } catch (emailError) {
                    console.warn('Failed to send team notification emails:', emailError);
                    // Don't fail the request if emails fail
                }
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    action: 'accepted',
                    teamId,
                    teamName,
                    version: FUNCTION_VERSION
                } as AcceptInviteResponse),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // CASE B: User exists but not authenticated - Send Magic Link
        if (userExists && existingProfile) {
            console.log(`Existing user ${inviteEmail} needs to authenticate, sending magic link`);

            // Generate magic link that redirects back to invite page
            const redirectUrl = `${siteUrl}/invite/accept?token=${token}&auto=true`;

            const { data: magicLinkData, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
                type: 'magiclink',
                email: inviteEmail,
                options: {
                    redirectTo: redirectUrl,
                }
            });

            if (magicLinkError) {
                console.error('Failed to generate magic link:', magicLinkError);
                return new Response(
                    JSON.stringify({
                        success: true,
                        action: 'needs_auth',
                        userExists: true,
                        email: inviteEmail,
                        teamName,
                        error: 'Could not send login link. Please log in manually.',
                        version: FUNCTION_VERSION
                    } as AcceptInviteResponse),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Send magic link via email
            if (gmailUser && gmailPassword && magicLinkData?.properties?.action_link) {
                const emailHtml = generateMagicLinkEmailHtml(teamName, magicLinkData.properties.action_link, inviteEmail);
                const result = await sendGmailEmail(
                    gmailUser,
                    gmailPassword,
                    inviteEmail,
                    `Join ${teamName} - Click to Login`,
                    emailHtml
                );

                if (result.success) {
                    console.log(`Magic link sent to ${inviteEmail}`);
                    return new Response(
                        JSON.stringify({
                            success: true,
                            action: 'needs_auth',
                            userExists: true,
                            email: inviteEmail,
                            teamName,
                            magicLinkSent: true,
                            version: FUNCTION_VERSION
                        } as AcceptInviteResponse),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
            }

            // Fallback: Ask user to login manually
            return new Response(
                JSON.stringify({
                    success: true,
                    action: 'needs_auth',
                    userExists: true,
                    email: inviteEmail,
                    teamName,
                    magicLinkSent: false,
                    version: FUNCTION_VERSION
                } as AcceptInviteResponse),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // CASE C: New user - Needs to sign up
        console.log(`New user ${inviteEmail} needs to sign up`);
        return new Response(
            JSON.stringify({
                success: true,
                action: 'needs_signup',
                userExists: false,
                email: inviteEmail,
                teamName,
                version: FUNCTION_VERSION
            } as AcceptInviteResponse),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in accept-invite-v2:', error);
        return new Response(
            JSON.stringify({
                success: false,
                action: 'error',
                error: (error as Error).message || 'Internal server error',
                version: FUNCTION_VERSION
            } as AcceptInviteResponse),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});
