import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { teamInviteService } from '@/lib/services/teamService';
import { useTeamStore } from '@/stores/teamStore';
import { useAuthStore } from '@/stores/authStore';
import { Loader2, CheckCircle2, XCircle, Users } from 'lucide-react';

export function AcceptInvitePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { teams, loadTeams, selectTeam } = useTeamStore();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'not_authenticated' | 'cancelled'>('loading');
  const [teamName, setTeamName] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthenticated) {
      setStatus('not_authenticated');
      return;
    }

    if (!token) {
      setError(t('team.invalidInvite'));
      setStatus('error');
      return;
    }

    acceptInvite();
  }, [token, isAuthenticated, authLoading]);

  const acceptInvite = async () => {
    if (!token) return;
    
    try {
      const team = await teamInviteService.acceptInvite(token);
      setTeamName(team.name);
      // Reload teams and select the new team
      await loadTeams();
      await selectTeam(team.id);
      setStatus('success');
    } catch (err: any) {
      // Check if it's a cancelled invite
      if (err.message.includes('cancelled') || err.message.includes('Invite not found')) {
        setStatus('cancelled');
      } else {
        setError(err.message || t('team.inviteError'));
        setStatus('error');
      }
    }
  };

  const handleLoginRedirect = () => {
    // Save the current URL to redirect back after login
    const returnUrl = window.location.pathname + window.location.search;
    navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t('team.acceptingInvite')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'not_authenticated') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{t('team.teamInvite')}</CardTitle>
            <CardDescription>{t('team.loginToAccept')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleLoginRedirect} className="w-full">
              {t('auth.login')}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              {t('auth.noAccount')}{' '}
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => {
                  const returnUrl = window.location.pathname + window.location.search;
                  navigate(`/signup?returnUrl=${encodeURIComponent(returnUrl)}`);
                }}
              >
                {t('auth.signup')}
              </Button>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              {t('common.goToDashboard', 'Go to Dashboard')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t('team.inviteFailed')}</h2>
            <p className="text-muted-foreground text-center mb-6">{error}</p>
            <Button onClick={() => navigate('/')}>{t('common.back')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{t('team.welcomeToTeam')}</h2>
          <p className="text-muted-foreground text-center mb-6">
            {t('team.joinedTeam', { team: teamName })}
          </p>
          <Button onClick={() => navigate('/')}>{t('team.goToDashboard')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
