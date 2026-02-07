import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { teamInviteService } from '@/lib/services/teamService';
import { useTeamStore } from '@/stores/teamStore';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle2, XCircle, Users, Timer, Mail } from 'lucide-react';

type InviteStatus = 'loading' | 'pending' | 'success' | 'error' | 'cancelled' | 'expired' | 'not_found';

interface InvitePreview {
  teamName?: string;
  inviterName?: string;
  email?: string;
}

export function AcceptInvitePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { isAuthenticated, isLoading: authLoading, user } = useAuthStore();
  const { loadTeams, selectTeam } = useTeamStore();

  const [status, setStatus] = useState<InviteStatus>('loading');
  const [invitePreview, setInvitePreview] = useState<InvitePreview>({});
  const [teamName, setTeamName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  // Signup form for unauthenticated users
  const [signupMode, setSignupMode] = useState(false);
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');

  // Verify actual Supabase session (not just authStore state)
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setHasValidSession(!!user);
      } catch {
        setHasValidSession(false);
      }
    };

    // Only verify if authStore thinks we're authenticated
    if (isAuthenticated && !authLoading) {
      verifySession();
    } else if (!authLoading) {
      setHasValidSession(false);
    }
  }, [isAuthenticated, authLoading]);

  // Load invite preview first (before auth check)
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

      // Pre-fill email for signup
      if (result.email) {
        setSignupForm(prev => ({ ...prev, email: result.email! }));
      }

      if (result.status === 'expired') {
        setStatus('expired');
      } else if (result.status === 'cancelled') {
        setStatus('cancelled');
      } else if (result.status === 'not_found') {
        setStatus('not_found');
        setError(t('team.inviteNotFound', 'Invitation not found'));
      } else if (result.status === 'accepted') {
        setError(t('team.inviteAlreadyAccepted', 'This invitation has already been accepted.'));
        setStatus('error');
      } else {
        setStatus('pending');
      }
    } catch (err) {
      console.error('Failed to load invite preview:', err);
      setStatus('not_found');
    }
  };

  // DO NOT auto-accept - show UI for user to explicitly accept/decline
  // Removed auto-accept for authenticated users

  const acceptInvite = async () => {
    if (!token || isAccepting) return;

    // Check if user has valid Supabase session before calling service
    if (!hasValidSession) {
      // Redirect to login with return URL
      const returnUrl = `/invite/accept?token=${token}`;
      navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsAccepting(true);

    try {
      const team = await teamInviteService.acceptInvite(token);
      if (!team) {
        throw new Error('Team not found');
      }
      setTeamName(team.name || 'Team');
      await loadTeams();
      await selectTeam(team.id);
      setStatus('success');
    } catch (err: any) {
      console.error('Accept invite error:', err.message);
      const msg = err.message || '';

      // Handle authentication errors - redirect to login
      if (msg.toLowerCase().includes('authenticated') || msg.toLowerCase().includes('auth')) {
        const returnUrl = `/invite/accept?token=${token}`;
        navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      if (msg.includes('cancelled')) {
        setStatus('cancelled');
      } else if (msg.includes('24 hours')) {
        setStatus('expired');
      } else {
        setError(msg || t('team.inviteError'));
        setStatus('error');
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const declineInvite = async () => {
    if (!token || isDeclining) return;
    setIsDeclining(true);

    try {
      // Just navigate away - no need to update DB for decline
      navigate('/');
    } finally {
      setIsDeclining(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');

    if (signupForm.password !== signupForm.confirmPassword) {
      setSignupError(t('auth.passwordMismatch', 'Passwords do not match'));
      return;
    }

    if (signupForm.password.length < 6) {
      setSignupError(t('auth.passwordTooShort', 'Password must be at least 6 characters'));
      return;
    }

    setSignupLoading(true);

    try {
      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: signupForm.email,
        password: signupForm.password,
        options: {
          data: {
            name: signupForm.name,
            invited_team_token: token, // Store token for post-verification
          },
          emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}`,
        },
      });

      if (error) throw error;

      if (data.user && !data.user.email_confirmed_at) {
        // Email confirmation required
        setStatus('success');
        setError(''); // Clear any errors
        // Show confirmation message
        navigate(`/auth/verify-email?email=${encodeURIComponent(signupForm.email)}&returnUrl=${encodeURIComponent(`/invite/accept?token=${token}`)}`);
      } else if (data.user) {
        // Auto-confirmed (dev mode), accept invite immediately
        await acceptInvite();
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setSignupError(err.message || t('auth.signupFailed', 'Sign up failed'));
    } finally {
      setSignupLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    const returnUrl = window.location.pathname + window.location.search;
    navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  // Loading state (including session verification)
  if (authLoading || status === 'loading' || hasValidSession === null) {
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

  // Pending state for unauthenticated users - Show invite info + signup/login options
  // Use hasValidSession to check actual Supabase session, not just authStore state
  if (status === 'pending' && !hasValidSession) {
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
              <div className="mt-2 px-3 py-2 bg-muted rounded-md">
                <p className="font-semibold text-lg">{invitePreview.teamName}</p>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!signupMode ? (
              <>
                <Button onClick={handleLoginRedirect} className="w-full">
                  {t('auth.loginToAccept', 'Log in to accept')}
                </Button>
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
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSignupMode(true)}
                >
                  {t('auth.createAccount', 'Create a new account')}
                </Button>
              </>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('auth.name', 'Name')}</Label>
                  <Input
                    id="name"
                    type="text"
                    value={signupForm.name}
                    onChange={(e) => setSignupForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('auth.namePlaceholder', 'John Doe')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="you@example.com"
                    required
                    disabled={!!invitePreview.email} // Disable if pre-filled from invite
                  />
                  {invitePreview.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {t('team.invitedEmail', 'This invitation was sent to this email')}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('auth.confirmPassword', 'Confirm Password')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={signupForm.confirmPassword}
                    onChange={(e) => setSignupForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                {signupError && (
                  <p className="text-sm text-destructive">{signupError}</p>
                )}

                <Button type="submit" className="w-full" disabled={signupLoading}>
                  {signupLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('auth.signupAndJoin', 'Sign up & Join Team')}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setSignupMode(false)}
                >
                  {t('common.back', 'Back')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Accepting state (authenticated user)
  if (isAccepting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t('team.acceptingInvite', 'Accepting invitation...')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pending state for authenticated users - Show accept/decline buttons
  // Only show if we have a verified valid Supabase session
  if (status === 'pending' && hasValidSession) {
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
              <div className="mt-2 px-3 py-2 bg-muted rounded-md">
                <p className="font-semibold text-lg">{invitePreview.teamName}</p>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={acceptInvite}
              className="w-full"
              disabled={isAccepting || isDeclining}
            >
              {isAccepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t('team.acceptInvite', 'Accept Invitation')}
            </Button>
            <Button
              variant="outline"
              onClick={declineInvite}
              className="w-full"
              disabled={isAccepting || isDeclining}
            >
              {isDeclining && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <XCircle className="h-4 w-4 mr-2" />
              {t('team.declineInvite', 'Decline')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Cancelled state
  if (status === 'cancelled') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <XCircle className="h-6 w-6 text-red-500" />
            </div>
            <CardTitle>{t('team.inviteCancelled', 'Invitation Cancelled')}</CardTitle>
            <CardDescription>{t('team.inviteCancelledMessage', 'This invitation has been cancelled by the team owner.')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate('/')} className="w-full">
              {t('common.goToDashboard', 'Go to Dashboard')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired state
  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
              <Timer className="h-6 w-6 text-orange-500" />
            </div>
            <CardTitle>{t('team.inviteExpired', 'Invitation Expired')}</CardTitle>
            <CardDescription>
              {t('team.inviteExpiredMessage', 'This invitation has expired after 24 hours. Please ask the team owner to send a new invitation.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate('/')} className="w-full">
              {t('common.goToDashboard', 'Go to Dashboard')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (status === 'error' || status === 'not_found') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t('team.inviteFailed', 'Failed to Accept Invitation')}</h2>
            <p className="text-muted-foreground text-center mb-6">{error}</p>
            <Button onClick={() => navigate('/')}>{t('common.back', 'Back')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{t('team.welcomeToTeam', 'Welcome to the Team!')}</h2>
          <p className="text-muted-foreground text-center mb-6">
            {t('team.joinedTeam', 'You have successfully joined {{team}}', { team: teamName || invitePreview.teamName })}
          </p>
          <Button onClick={() => navigate('/')}>{t('team.goToDashboard', 'Go to Dashboard')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
