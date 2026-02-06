import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RemovalEmailRequest {
    email: string;
    userName: string;
    teamName: string;
    removerName: string;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { email, userName, teamName, removerName }: RemovalEmailRequest = await req.json();

        console.log('Sending removal email to:', email, 'for team:', teamName);

        // Check if Gmail SMTP is configured
        const gmailUser = Deno.env.get('GMAIL_USER');
        const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');

        if (!gmailUser || !gmailAppPassword) {
            console.log('Gmail not configured, skipping email');
            return new Response(
                JSON.stringify({ success: true, message: 'Email not sent (Gmail not configured)' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Create HTML email content
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; }
    .logo { font-size: 24px; font-weight: bold; color: #6366f1; }
    .content { padding: 30px 0; }
    .notice-box { background: #fef3f2; border: 1px solid #fecaca; border-radius: 12px; padding: 24px; text-align: center; }
    .notice-title { font-size: 20px; font-weight: 600; color: #dc2626; margin-bottom: 12px; }
    .team-name { font-size: 18px; font-weight: 600; color: #111; margin: 8px 0; }
    p { color: #666; margin: 16px 0; }
    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Lil PM</div>
    </div>
    <div class="content">
      <div class="notice-box">
        <div class="notice-title">You've been removed from a team</div>
        <div class="team-name">${teamName}</div>
      </div>
      <p>Hi ${userName || 'there'},</p>
      <p><strong>${removerName}</strong> has removed you from <strong>${teamName}</strong>.</p>
      <p>You no longer have access to this team's projects, issues, and documents.</p>
      <p>If you believe this was a mistake, please contact the team administrator.</p>
    </div>
    <div class="footer">
      <p>This email was sent by Lil PM</p>
    </div>
  </div>
</body>
</html>
    `;

        // Send email via Gmail SMTP
        const emailData = {
            from: gmailUser,
            to: email,
            subject: `You've been removed from ${teamName} - Lil PM`,
            html: htmlContent,
        };

        // Using Gmail SMTP via fetch to a simple SMTP relay
        // For now, we'll use the Resend API if available, otherwise skip
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        const senderEmail = Deno.env.get('SENDER_EMAIL') || gmailUser;

        if (resendApiKey) {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: senderEmail,
                    to: [email],
                    subject: `You've been removed from ${teamName} - Lil PM`,
                    html: htmlContent,
                }),
            });

            const result = await response.json();
            console.log('Resend response:', result);

            if (!response.ok) {
                console.error('Resend error:', result);
                // Don't throw - just log the error
            }
        } else {
            console.log('No email service configured');
        }

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error sending removal email:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
