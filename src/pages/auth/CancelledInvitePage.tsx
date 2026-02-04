import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CancelledInvitePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-xl shadow-2xl p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-3">
            {t('team.inviteCancelled', 'Invitation Cancelled')}
          </h1>
          
          <p className="text-muted-foreground mb-6 leading-relaxed">
            {t('team.inviteCancelledMessage', 'This invitation has been cancelled by the team owner. You can no longer use this link to join the team.')}
          </p>

          <div className="space-y-3">
            <Button 
              onClick={() => navigate('/login')} 
              className="w-full"
            >
              {t('auth.goToLogin', 'Go to Login')}
            </Button>
            
            <Button 
              onClick={() => navigate('/')} 
              variant="outline"
              className="w-full"
            >
              {t('common.goHome', 'Go Home')}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            {t('team.needHelp', 'Need help? Contact the team owner for a new invitation.')}
          </p>
        </div>
      </div>
    </div>
  );
}

