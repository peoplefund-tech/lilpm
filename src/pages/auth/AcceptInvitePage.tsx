import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { teamInviteService } from '@/lib/services/teamService';
import { useTeamStore } from '@/stores/teamStore';
import { useAuthStore } from '@/stores/authStore';
import { useMCPStore } from '@/stores/mcpStore';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle2, XCircle, Users, Mail, LogIn, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { notificationService } from '@/lib/services/notificationService';
import { teamMemberService } from '@/lib/services/team/teamMemberService';

type InviteStatus = 'loading' | 'pending' | 'processing' | 'success' | 'error' | 'magic_link_sent';

interface InvitePreview {
  teamName?: string;
  inviterName?: string;
  email?: string;
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
}

export function AcceptInvitePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const autoAccept = searchParams.get('auto') === 'true';

  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { loadTeams, selectTeam } = useTeamStore();
  const { setOnboardingCompleted } = useMCPStore();

  const [status, setStatus] = useState<InviteStatus>('loading');
  const [invitePreview, setInvitePreview] = useState<InvitePreview>({});
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lbzjnhlribtfwnoydpdv.supabase.co';

  // Load invite preview on mount
  useEffect(() => {
    if (!token) {
      setError(t('team.invalidInvite', 'Invalid invitation link'));
      setStatus('error');
      return;
    }
    loadInvitePreview();
  }, [token]);

  const loadInvitePreview = async () => {
    if (!token) return;

    try {
      const result = await teamInviteService.getInvitePreview(token);
      setInvitePreview({
        teamName: result.teamName,
        inviterName: result.inviterName,
        email: result.email,
      });

      if (result.status === 'expired') {
        setError(t('team.inviteExpired', 'This invitation has expired'));
        setStatus('error');
      } else if (result.status === 'cancelled') {
        setError(t('team.inviteCancelled', 'This invitation has been cancelled'));
        setStatus('error');
      } else if (result.status === 'not_found') {
        setError(t('team.inviteNotFound', 'Invitation not found'));
        setStatus('error');
      } else if (result.status === 'accepted') {
        setError(t('team.inviteAlreadyAccepted', 'This invitation has already been accepted'));
        setStatus('error');
      } else {
        setStatus('pending');
      }
    } catch (err) {
      console.error('Failed to load invite preview:', err);
      setError(t('team.inviteNotFound', 'Invitation not found'));
      setStatus('error');
    }
  };

  // Auto-accept when returning from Magic Link authentication
  useEffect(() => {
    if (autoAccept && isAuthenticated && user?.id && status === 'pending' && token) {
      handleAcceptInvite();
    }
  }, [autoAccept, isAuthenticated, user?.id, status, token]);

  // Main accept handler - calls Edge Function
  const handleAcceptInvite = useCallback(async () => {
    if (!token || isProcessing) return;

    setIsProcessing(true);
    setStatus('processing');

    try {
      // Get current user ID if authenticated
      let userId: string | undefined;
      if (isAuthenticated) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        userId = currentUser?.id;
      }

      // Call Edge Function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/accept-invite-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userId }),
      });

      const result: AcceptInviteResponse = await response.json();

      if (!result.success && result.action === 'error') {
        setError(result.error || t('team.inviteError', 'Failed to accept invitation'));
        setStatus('error');
        return;
      }

      switch (result.action) {
        case 'accepted':
          // Success! Reload teams and navigate to dashboard
          toast.success(t('team.inviteAccepted', `You've joined ${result.teamName}!`));
          await loadTeams();
          if (result.teamId) {
            await selectTeam(result.teamId);

            // Create notifications for inviter and team members
            try {
              // Get team members to notify
              const teamMembers = await teamMemberService.getMembers(result.teamId);
              const inviterId = invitePreview.inviterName ?
                teamMembers.find(m => m.profile?.name === invitePreview.inviterName)?.user_id : null;

              // Notify the inviter that their invite was accepted
              if (inviterId && user?.id && user.id !== inviterId) {
                await notificationService.createNotification(
                  inviterId,
                  'invite_accepted',
                  t('notifications.inviteAccepted', 'Invite Accepted'),
                  t('notifications.inviteAcceptedBody', `${user?.name || 'A new member'} has joined the team!`),
                  { teamId: result.teamId, newMemberId: user?.id }
                );
              }

              // Notify all other team members about the new member
              for (const member of teamMembers) {
                if (member.user_id !== user?.id && member.user_id !== inviterId) {
                  await notificationService.createNotification(
                    member.user_id,
                    'invite_accepted',
                    t('notifications.newTeamMember', 'New Team Member'),
                    t('notifications.newTeamMemberBody', `${user?.name || 'Someone'} has joined ${result.teamName}!`),
                    { teamId: result.teamId, newMemberId: user?.id }
                  );
                }
              }
            } catch (notifyErr) {
              console.warn('Failed to send join notifications:', notifyErr);
            }
          }
          setOnboardingCompleted(true);
          setStatus('success');
          setTimeout(() => navigate('/dashboard'), 1500);
          break;

        case 'needs_auth': {
          // Existing user - Magic Link was sent or needs to login
          if (result.magicLinkSent) {
            setStatus('magic_link_sent');
            toast.success(t('team.magicLinkSent', 'Check your email for a login link!'));
          } else {
            // Magic link failed, redirect to login
            const returnUrl = `/invite/accept?token=${token}&auto=true`;
            navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
          }
          break;
        }

        case 'needs_signup': {
          // New user - redirect to signup
          const signupUrl = `/signup?email=${encodeURIComponent(result.email || '')}&returnUrl=${encodeURIComponent(`/invite/accept?token=${token}&auto=true`)}`;
          navigate(signupUrl);
          break;
        }

        default:
          setError(t('team.inviteError', 'Unexpected error'));
          setStatus('error');
      }
    } catch (err) {
      console.error('Accept invite error:', err);
      setError(err instanceof Error ? err.message : t('team.inviteError', 'Failed to accept invitation'));
      setStatus('error');
    } finally {
      setIsProcessing(false);
    }
  }, [token, isProcessing, isAuthenticated, navigate, loadTeams, selectTeam, setOnboardingCompleted, t, SUPABASE_URL]);

  const handleLoginRedirect = () => {
    const returnUrl = `/invite/accept?token=${token}&auto=true`;
    navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  const handleSignupRedirect = () => {
    const returnUrl = `/invite/accept?token=${token}&auto=true`;
    const email = invitePreview.email || '';
    navigate(`/signup?email=${encodeURIComponent(email)}&returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  // Loading state
  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t('team.loadingInvite', 'Loading invitation...')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('team.inviteError', 'Invitation Error')}</h2>
            <p className="text-muted-foreground text-center mb-6">{error}</p>
            <Button onClick={() => navigate('/')} variant="outline">
              {t('common.goHome', 'Go to Home')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('team.welcomeToTeam', 'Welcome to the team!')}</h2>
            <p className="text-muted-foreground text-center mb-6">
              {t('team.redirectingToDashboard', 'Redirecting to dashboard...')}
            </p>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Magic Link sent state
  if (status === 'magic_link_sent') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>{t('team.checkEmail', 'Check Your Email')}</CardTitle>
            <CardDescription>
              {t('team.magicLinkDescription', 'We sent a login link to your email. Click it to join the team automatically.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              {invitePreview.email && (
                <span>Sent to: <strong>{invitePreview.email}</strong></span>
              )}
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={handleLoginRedirect} className="w-full">
                <LogIn className="h-4 w-4 mr-2" />
                {t('auth.loginWithPassword', 'Login with password instead')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Processing state
  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t('team.processingInvite', 'Processing invitation...')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pending state - show invite details and accept button
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{t('team.teamInvite', 'Team Invitation')}</CardTitle>
          <CardDescription>
            {invitePreview.inviterName
              ? t('team.invitedBy', '{{name}} has invited you to join', { name: invitePreview.inviterName })
              : t('team.youveBeenInvited', "You've been invited to join")}
          </CardDescription>
          {invitePreview.teamName && (
            <div className="mt-4 px-4 py-3 bg-muted rounded-lg">
              <p className="font-semibold text-lg">{invitePreview.teamName}</p>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Single Accept Button */}
          <Button
            onClick={handleAcceptInvite}
            className="w-full"
            size="lg"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('common.processing', 'Processing...')}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {t('team.acceptInvitation', 'Accept Invitation')}
              </>
            )}
          </Button>

          {/* Secondary options */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('common.or', 'Or')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleLoginRedirect} className="w-full">
              <LogIn className="h-4 w-4 mr-2" />
              {t('auth.login', 'Log In')}
            </Button>
            <Button variant="outline" onClick={handleSignupRedirect} className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              {t('auth.signup', 'Sign Up')}
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => navigate('/')}
          >
            <XCircle className="h-4 w-4 mr-2" />
            {t('team.declineInvite', 'Decline invitation')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
