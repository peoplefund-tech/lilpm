import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/layout';
import { useTeamStore } from '@/stores/teamStore';
import { teamMemberService, teamInviteService, type TeamMemberWithProfile } from '@/lib/services/teamService';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  MoreHorizontal,
  Mail,
  UserMinus,
  Shield,
  ShieldCheck,
  Crown,
  Clock,
  Loader2,
  X,
  RefreshCw,
  Copy,
  Building2,
  Timer,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { TeamRole, TeamInvite } from '@/types/database';

export function TeamMembersPage() {
  const { t } = useTranslation();
  const { currentTeam, teams, selectTeam } = useTeamStore();
  const [members, setMembers] = useState<TeamMemberWithProfile[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');
  const [isSending, setIsSending] = useState(false);
  const [removeMember, setRemoveMember] = useState<TeamMemberWithProfile | null>(null);
  const [activeTab, setActiveTab] = useState<string>('members');

  const roleLabels: Record<TeamRole, string> = {
    owner: t('team.owner'),
    admin: t('team.admin'),
    member: t('team.member'),
    guest: t('team.guest'),
  };

  const roleIcons: Record<TeamRole, React.ReactNode> = {
    owner: <Crown className="h-3 w-3" />,
    admin: <ShieldCheck className="h-3 w-3" />,
    member: <Shield className="h-3 w-3" />,
    guest: <Shield className="h-3 w-3" />,
  };

  const roleBadgeVariants: Record<TeamRole, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    owner: 'default',
    admin: 'secondary',
    member: 'outline',
    guest: 'outline',
  };

  // Helper function to check if invite is expired
  const isInviteExpired = (invite: TeamInvite): boolean => {
    if (!invite.expires_at) return false;
    return new Date(invite.expires_at) < new Date();
  };

  // Helper function to get remaining time
  const getRemainingTime = (expiresAt: string): string => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
  };

  // Real-time countdown timer refresh
  const [, setRefreshCounter] = React.useState(0);
  React.useEffect(() => {
    // Refresh every minute to update countdown timers
    const timer = setInterval(() => {
      setRefreshCounter(c => c + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    if (!currentTeam) return;

    setIsLoading(true);
    try {
      const [membersData, invitesData] = await Promise.all([
        teamMemberService.getMembers(currentTeam.id),
        teamInviteService.getInvites(currentTeam.id),
      ]);
      setMembers(membersData);
      setInvites(invitesData);
    } catch (error) {
      console.error('Failed to load team data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Use ref to track inviteOpen state without causing useEffect re-runs
  const inviteOpenRef = React.useRef(inviteOpen);
  React.useEffect(() => {
    inviteOpenRef.current = inviteOpen;
  }, [inviteOpen]);

  // Set up realtime subscription for team members and invites
  useEffect(() => {
    if (!currentTeam) return;

    loadData();

    // Subscribe to team_members changes
    const memberSubscription = supabase
      .channel(`team_members_page:${currentTeam.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `team_id=eq.${currentTeam.id}`,
        },
        (payload) => {
          console.log('Team member change:', payload);
          // Only reload if dialog is not open to prevent closing it
          if (!inviteOpenRef.current) {
            loadData();
          }
        }
      )
      .subscribe();

    // Subscribe to team_invites changes
    const inviteSubscription = supabase
      .channel(`team_invites_page:${currentTeam.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_invites',
          filter: `team_id=eq.${currentTeam.id}`,
        },
        (payload) => {
          console.log('Team invite change:', payload);
          // Only reload if dialog is not open to prevent closing it
          if (!inviteOpenRef.current) {
            loadData();
          }
        }
      )
      .subscribe();

    return () => {
      memberSubscription.unsubscribe();
      inviteSubscription.unsubscribe();
    };
  }, [currentTeam?.id]); // Only depend on team ID, not inviteOpen

  const handleInvite = async () => {
    if (!currentTeam || !inviteEmail) return;

    setIsSending(true);
    try {
      const newInvite = await teamInviteService.createInvite(currentTeam.id, inviteEmail, inviteRole);

      // Show different message based on whether user exists
      if ((newInvite as any).isExistingUser) {
        toast.success(t('team.inviteSentExistingUser', 'Invitation sent! The user will be notified via email and in-app notification.'));
      } else {
        toast.success(t('team.inviteSent'));
      }

      // Immediately add the invite to the local state for instant UI update
      setInvites(prev => [...prev, newInvite]);

      setInviteEmail('');
      setInviteOpen(false);
      setActiveTab('invites'); // Switch to Pending tab after invite

      // Also reload data to ensure consistency
      await loadData();
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await teamInviteService.cancelInvite(inviteId);
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      toast.success(t('team.inviteCancelled'));
      loadData(); // Still reload to be safe, but state update gives instant feedback
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleResendInvite = async (invite: TeamInvite) => {
    try {
      // Cancel and recreate the invite
      await teamInviteService.cancelInvite(invite.id);
      await teamInviteService.createInvite(currentTeam!.id, invite.email, invite.role);
      toast.success(t('team.inviteResent'));
      loadData();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleCopyInviteLink = (invite: TeamInvite) => {
    const inviteLink = `${window.location.origin}/invite/accept?token=${invite.token}`;
    navigator.clipboard.writeText(inviteLink);
    toast.success(t('issues.linkCopied'));
  };

  const handleRemoveMember = async () => {
    if (!removeMember) return;

    try {
      await teamMemberService.removeMember(removeMember.id);
      toast.success(t('team.memberRemoved'));
      setRemoveMember(null);
      loadData();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleRoleChange = async (memberId: string, role: TeamRole) => {
    try {
      await teamMemberService.updateMemberRole(memberId, role);
      toast.success(t('team.roleUpdated'));
      loadData();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        {/* Header with Team Selector */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">{t('nav.teamMembers')}</h1>
            {/* Team Selector */}
            {teams.length > 1 ? (
              <div className="flex items-center gap-2 mt-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={currentTeam?.id}
                  onValueChange={(teamId) => {
                    const team = teams.find(t => t.id === teamId);
                    if (team) selectTeam(team);
                  }}
                >
                  <SelectTrigger className="h-8 w-[180px]">
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
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                {currentTeam?.name}
              </p>
            )}
          </div>

          <Button onClick={() => setInviteOpen(true)} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            {t('team.inviteMember')}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex">
            <TabsTrigger value="members" className="text-xs sm:text-sm">{t('team.members')} ({members.length})</TabsTrigger>
            <TabsTrigger value="invites" className="text-xs sm:text-sm">{t('team.pending')} ({invites.length})</TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members">
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('team.member')}</TableHead>
                    <TableHead>{t('team.role')}</TableHead>
                    <TableHead>{t('team.joined')}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {t('team.noMembers')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.profile?.avatar_url || undefined} />
                              <AvatarFallback>
                                {member.profile?.name?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">
                                {member.profile?.name || 'User'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {member.profile?.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={roleBadgeVariants[member.role]} className="gap-1">
                            {roleIcons[member.role]}
                            {roleLabels[member.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(member.joined_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {member.role !== 'owner' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'admin')}>
                                  <ShieldCheck className="h-4 w-4 mr-2" />
                                  {t('team.admin')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'member')}>
                                  <Shield className="h-4 w-4 mr-2" />
                                  {t('team.member')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setRemoveMember(member)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  {t('team.remove')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Pending Invites Tab */}
          <TabsContent value="invites">
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('auth.email')}</TableHead>
                    <TableHead>{t('team.role')}</TableHead>
                    <TableHead>{t('common.status', 'Status')}</TableHead>
                    <TableHead>{t('team.timeLeft', 'Time Left')}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        {t('team.noInvitations')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{invite.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={roleBadgeVariants[invite.role]}>
                            {roleLabels[invite.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isInviteExpired(invite) ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Expired
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Timer className="h-3 w-3" />
                              Waiting
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {invite.expires_at ? (
                            isInviteExpired(invite) ? (
                              <span className="text-destructive">—</span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Timer className="h-3 w-3" />
                                {getRemainingTime(invite.expires_at)}
                              </span>
                            )
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleCopyInviteLink(invite)}>
                                <Copy className="h-4 w-4 mr-2" />
                                {t('issues.copyLink')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResendInvite(invite)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                {t('team.resendInvite')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleCancelInvite(invite.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <X className="h-4 w-4 mr-2" />
                                {t('team.cancelInvite')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Invite Dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{t('team.inviteMember')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('auth.email')}</label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('team.role')}</label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        {t('team.admin')}
                      </div>
                    </SelectItem>
                    <SelectItem value="member">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {t('team.member')}
                      </div>
                    </SelectItem>
                    <SelectItem value="guest">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {t('team.guest')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleInvite} disabled={!inviteEmail || isSending}>
                  {isSending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  {t('team.inviteMember')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove Member Confirmation */}
        <AlertDialog open={!!removeMember} onOpenChange={(open) => !open && setRemoveMember(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('team.removeMember')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('team.confirmRemove', { name: removeMember?.profile?.name || 'this member' })}
                <br />
                <span className="text-muted-foreground">{t('team.confirmRemoveDesc')}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveMember}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('team.remove')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
