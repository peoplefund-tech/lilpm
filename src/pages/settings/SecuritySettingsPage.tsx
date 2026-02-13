import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Shield,
  Key,
  Smartphone,
  LogOut,
  AlertTriangle,
  Eye,
  EyeOff,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AppLayout } from '@/components/layout';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

export function SecuritySettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logout } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('security.passwordMismatch'));
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t('auth.passwordTooShort'));
      return;
    }

    setIsUpdating(true);
    try {
      const res = await apiClient.put('/auth/password', {
        password: newPassword,
      });

      if (!res.success) throw new Error(res.error);

      toast.success(t('profile.passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error(t('profile.passwordError'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    try {
      const res = await apiClient.post('/auth/logout', {
        refreshToken: localStorage.getItem('auth_refresh_token'),
      });

      if (!res.success) throw new Error(res.error);

      toast.success(t('security.loggedOutAll'));
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error(t('common.error'));
    }
  };

  const handleDeleteAccount = async () => {
    // This would typically require backend implementation
    toast.error(t('security.deleteAccountContact'));
  };

  return (
    <AppLayout>
      <div className="w-full p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              {t('settings.security')}
            </h1>
            <p className="text-slate-400">
              {t('security.description')}
            </p>
          </div>
        </div>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {t('profile.changePassword')}
            </CardTitle>
            <CardDescription>
              {t('profile.changePasswordDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('profile.currentPassword')}</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button
              onClick={handlePasswordChange}
              disabled={isUpdating || !newPassword || !confirmPassword}
            >
              {isUpdating ? t('common.loading') : t('profile.updatePassword')}
            </Button>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              {t('security.twoFactor')}
            </CardTitle>
            <CardDescription>
              {t('security.twoFactorDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{t('security.enableTwoFactor')}</p>
                <p className="text-sm text-slate-400">
                  {t('security.twoFactorStatus', { status: twoFactorEnabled ? t('common.enabled') : t('common.disabled') })}
                </p>
              </div>
              <Switch
                checked={twoFactorEnabled}
                onCheckedChange={(checked) => {
                  setTwoFactorEnabled(checked);
                  toast.info(t('security.twoFactorComingSoon'));
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('security.activeSessions')}
            </CardTitle>
            <CardDescription>
              {t('security.activeSessionsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#121215] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-green-500 rounded-full" />
                <div>
                  <p className="font-medium">{t('security.currentSession')}</p>
                  <p className="text-sm text-slate-400">
                    {t('security.thisDevice')}
                  </p>
                </div>
              </div>
            </div>
            <Separator />
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogoutAllDevices}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('security.logoutAllDevices')}
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('security.dangerZone')}
            </CardTitle>
            <CardDescription>
              {t('security.dangerZoneDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  {t('security.deleteAccount')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('security.deleteAccountTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('security.deleteAccountDesc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t('security.deleteAccount')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
