import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { useTeamStore } from '@/stores/teamStore';
import { teamService, teamMemberService } from '@/lib/services/teamService';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Users,
  Trash2,
  Loader2,
  Save,
  AlertTriangle,
  Building2,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';
import type { TeamRole } from '@/types/database';

export function TeamSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentTeam, teams, selectTeam, loadTeams, deleteTeam } = useTeamStore();

  const [name, setName] = useState('');
  const [issuePrefix, setIssuePrefix] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [userRole, setUserRole] = useState<TeamRole | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [leaveConfirmation, setLeaveConfirmation] = useState('');

  useEffect(() => {
    if (currentTeam) {
      setName(currentTeam.name);
      // Load issue_prefix directly from the database if needed
      setIssuePrefix('');

      // Fetch the full team data including issue_prefix
      const loadTeamDetails = async () => {
        try {
          const fullTeam = await teamService.getTeam(currentTeam.id);
          if (fullTeam) {
            setIssuePrefix(fullTeam.issue_prefix || '');
          }
        } catch (e) {
          console.error('Failed to load team details:', e);
        }
      };
      loadTeamDetails();
    }
  }, [currentTeam]);

  useEffect(() => {
    const loadUserRole = async () => {
      if (currentTeam && user) {
        const role = await teamMemberService.getUserRole(currentTeam.id, user.id);
        setUserRole(role);
      }
    };
    loadUserRole();
  }, [currentTeam, user]);

  const canEdit = userRole === 'owner' || userRole === 'admin';
  const canDelete = userRole === 'owner';

  const handleSave = async () => {
    if (!currentTeam || !name.trim()) return;

    setIsSaving(true);
    try {
      await teamService.updateTeam(currentTeam.id, {
        name: name.trim(),
        issue_prefix: issuePrefix.trim() || undefined,
      });
      await loadTeams();
      toast.success(t('settings.saved'));
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentTeam || deleteConfirmation !== currentTeam.name) return;

    setIsDeleting(true);
    try {
      await deleteTeam(currentTeam.id);

      // Switch to another team if available
      const remainingTeams = teams.filter(t => t.id !== currentTeam.id);
      if (remainingTeams.length > 0) {
        await selectTeam(remainingTeams[0].id);
        navigate('/dashboard');
      } else {
        navigate('/onboarding/create-team');
      }

      toast.success(t('teamSettings.teamDeleted'));
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setIsDeleting(false);
      setDeleteConfirmation('');
    }
  };

  const handleLeaveTeam = async () => {
    if (!currentTeam || !user || leaveConfirmation !== 'LEAVE') return;

    // Check if user is the only owner
    if (userRole === 'owner') {
      toast.error(t('teamSettings.cannotLeaveAsOwner', 'You must transfer ownership before leaving'));
      return;
    }

    setIsLeaving(true);
    try {
      // Remove user from team
      await teamMemberService.removeMember(user.id);

      // Reload teams and switch to another team
      await loadTeams();
      const remainingTeams = teams.filter(t => t.id !== currentTeam.id);
      if (remainingTeams.length > 0) {
        await selectTeam(remainingTeams[0].id);
        navigate('/dashboard');
      } else {
        navigate('/onboarding/create-team');
      }

      toast.success(t('teamSettings.leftTeam', 'You have left the team'));
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setIsLeaving(false);
      setLeaveConfirmation('');
    }
  };

  if (!currentTeam) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header with Team Selector */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
              {t('teamSettings.title', 'Team Settings')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('teamSettings.description', 'Manage your team settings and preferences')}
            </p>
          </div>

          {/* Team Selector */}
          {teams.length > 1 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select
                value={currentTeam?.id}
                onValueChange={(teamId) => {
                  const team = teams.find(t => t.id === teamId);
                  if (team) selectTeam(team.id);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t('team.selectTeam', 'Select Team')} />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('settings.general')}</CardTitle>
            <CardDescription>
              {t('teamSettings.generalDesc', 'Basic information about your team')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('teamSettings.teamName', 'Team Name')}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('onboarding.teamNamePlaceholder', 'e.g. Acme Inc.')}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('teamSettings.issuePrefix', 'Issue Prefix')}</label>
              <Input
                value={issuePrefix}
                onChange={(e) => setIssuePrefix(e.target.value.toUpperCase().slice(0, 5))}
                placeholder="e.g. ACME"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                {t('teamSettings.issuePrefixDesc', 'Used for issue identifiers like ACME-123')}
              </p>
            </div>

            {canEdit && (
              <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t('common.save')}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('teamSettings.quickActions', 'Quick Actions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/team/members')}
            >
              <Users className="h-4 w-4 mr-2" />
              {t('teamSettings.manageMembers', 'Manage Team Members')}
            </Button>
          </CardContent>
        </Card>

        {/* Leave Team - Only for non-owners */}
        {userRole !== 'owner' && (
          <Card className="border-orange-500/50">
            <CardHeader>
              <CardTitle className="text-lg text-orange-600 flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                {t('teamSettings.leaveTeam', 'Leave Team')}
              </CardTitle>
              <CardDescription>
                {t('teamSettings.leaveTeamDesc', 'Remove yourself from this team')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-500/10">
                    <LogOut className="h-4 w-4" />
                    {t('teamSettings.leaveTeam', 'Leave Team')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('teamSettings.leaveTeamTitle', 'Leave this team?')}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        {t('teamSettings.leaveTeamConfirmDesc', 'You will lose access to all projects, issues, and data in this team. You can rejoin if invited again.')}
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          {t('teamSettings.typeLeaveToConfirm', 'Type LEAVE to confirm')}
                        </p>
                        <Input
                          value={leaveConfirmation}
                          onChange={(e) => setLeaveConfirmation(e.target.value.toUpperCase())}
                          placeholder="LEAVE"
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setLeaveConfirmation('')}>
                      {t('common.cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLeaveTeam}
                      disabled={leaveConfirmation !== 'LEAVE' || isLeaving}
                      className="bg-orange-600 text-white hover:bg-orange-700"
                    >
                      {isLeaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4 mr-2" />
                      )}
                      {t('teamSettings.confirmLeave', 'Leave Team')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone */}
        {canDelete && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-lg text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {t('security.dangerZone')}
              </CardTitle>
              <CardDescription>
                {t('teamSettings.dangerZoneDesc', 'Irreversible actions for your team')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    {t('teamSettings.deleteTeam', 'Delete Team')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('teamSettings.deleteTeamTitle', 'Delete this team?')}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        {t('teamSettings.deleteTeamDesc', 'This action cannot be undone. All projects, issues, and data associated with this team will be permanently deleted.')}
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          {t('teamSettings.typeToConfirm', 'Type the team name to confirm:')} <strong>{currentTeam.name}</strong>
                        </p>
                        <Input
                          value={deleteConfirmation}
                          onChange={(e) => setDeleteConfirmation(e.target.value)}
                          placeholder={currentTeam.name}
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirmation('')}>
                      {t('common.cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleteConfirmation !== currentTeam.name || isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      {t('teamSettings.confirmDelete', 'Delete Team')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
