import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const FUNCTION_VERSION = '2026-02-06.1';

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const siteUrl = Deno.env.get('SITE_URL') || 'https://lilpmaiai.vercel.app';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { inviteId, email, teamName, inviterName, role, token, targetUserId }: InviteEmailRequest = await req.json();

    console.log(`[${FUNCTION_VERSION}] Processing invite for ${email} (Target User: ${targetUserId || 'New User'})`);

    const inviteLink = `${siteUrl}/invite/accept?token=${token}`;

    // CASE 1: Existing user - Create notification only (no email)
    if (targetUserId) {
      console.log(`Existing user ${email} - Creating in-app notification only`);

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
              teamName: teamName,
              inviterName: inviterName,
              role: role,
              token: token,
              inviteLink: inviteLink,
            },
          });

        if (notifError) {
          console.error('Failed to create notification:', notifError);
          return new Response(
            JSON.stringify({
              success: true,
              emailSent: false,
              notificationCreated: false,
              message: 'Invitation created but notification failed',
              error: notifError.message,
              version: FUNCTION_VERSION
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Notification created for existing user ${targetUserId}`);
        return new Response(
          JSON.stringify({
            success: true,
            emailSent: false,
            notificationCreated: true,
            message: 'Invitation created. User will see notification in their inbox.',
            version: FUNCTION_VERSION
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error('Error creating notification:', err);
        return new Response(
          JSON.stringify({
            success: true,
            emailSent: false,
            notificationCreated: false,
            message: 'Invitation created but notification failed',
            version: FUNCTION_VERSION
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // CASE 2: New user - Use Supabase Auth invite email
    console.log(`New user ${email} - Sending Supabase Auth invite email`);

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
      console.error('Supabase Auth invite error:', emailError);

      // If the error is "email_exists", treat as existing user
      if (emailError.message?.includes('already been registered') ||
        emailError.message?.includes('email_exists')) {
        console.log('User exists but was not detected - creating fallback');
        return new Response(
          JSON.stringify({
            success: true,
            emailSent: false,
            message: 'User may already exist. Please ask them to log in and check notifications.',
            version: FUNCTION_VERSION
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          emailSent: false,
          message: 'Invitation created but email failed to send',
          error: emailError.message,
          version: FUNCTION_VERSION
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Supabase Auth invite email sent successfully to ${email}`);
    return new Response(
      JSON.stringify({
        success: true,
        emailSent: true,
        message: 'Invitation email sent via Supabase Auth',
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
