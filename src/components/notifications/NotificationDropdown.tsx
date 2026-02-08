import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  User,
  MessageSquare,
  AlertCircle,
  Clock,
  Check,
  CheckCheck,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { useTeamStore } from '@/stores/teamStore';
import { useIssueStore } from '@/stores/issueStore';
import { notificationService, type NotificationType } from '@/lib/services/notificationService';

const NOTIFICATION_ICONS: Record<NotificationType, React.ElementType> = {
  issue_assigned: User,
  issue_mentioned: MessageSquare,
  comment_added: MessageSquare,
  status_changed: AlertCircle,
  due_date_reminder: Clock,
  invite_accepted: Check,
  invite_rejected: AlertCircle,
  invite_expired: Clock,
  prd_created: MessageSquare,
  issue_created: AlertCircle,
  mention_notification: User,
};

export function NotificationDropdown() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ko' ? ko : enUS;
  const { user } = useAuthStore();
  const { currentTeam } = useTeamStore();
  const { issues } = useIssueStore();
  const {
    notifications,
    unreadCount,
    loadNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  // Load notifications on mount
  useEffect(() => {
    if (user?.id) {
      loadNotifications(user.id);
    }
  }, [user?.id, loadNotifications]);

  // Check for due date reminders when issues change
  useEffect(() => {
    const checkReminders = async () => {
      if (!user?.id || issues.length === 0) return;

      // Convert frontend issues to database format for the service
      const dbIssues = issues.map(issue => ({
        id: issue.id,
        team_id: issue.teamId,
        project_id: issue.projectId || null,
        cycle_id: issue.cycleId || null,
        parent_id: issue.parentId || null,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description || null,
        status: issue.status,
        priority: issue.priority,
        assignee_id: issue.assigneeId || null,
        creator_id: issue.creatorId,
        estimate: issue.estimate || null,
        due_date: issue.dueDate || null,
        sort_order: issue.sortOrder,
        created_at: issue.createdAt,
        updated_at: issue.updatedAt,
      }));

      const newNotifications = await notificationService.checkDueDateReminders(user.id, dbIssues as any);
      newNotifications.forEach(n => addNotification(n));
    };

    checkReminders();
  }, [user?.id, issues, addNotification]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.id || !currentTeam?.id) return;

    const unsubscribe = notificationService.subscribeToIssueChanges(
      currentTeam.id,
      user.id,
      (notification) => {
        addNotification(notification);
      }
    );

    return unsubscribe;
  }, [user?.id, currentTeam?.id, addNotification]);

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (user?.id && !notification.read) {
      await markAsRead(notification.id, user.id);
    }

    // Navigate based on notification data - support multiple key formats
    const data = notification.data || {};

    // Check for issue navigation (issue_id, issueId, entity_id with issue type)
    const issueId = data.issue_id || data.issueId ||
      (notification.type?.includes('issue') && data.entity_id) || null;

    // Check for PRD navigation (prd_id, prdId, entity_id with prd type)
    const prdId = data.prd_id || data.prdId ||
      (notification.type?.includes('prd') && data.entity_id) || null;

    // Check for team navigation (invite_accepted)
    const teamId = data.teamId || data.team_id || null;

    if (issueId) {
      navigate(`/issue/${issueId}`);
    } else if (prdId) {
      navigate(`/prd/${prdId}`);
    } else if (teamId && notification.type === 'invite_accepted') {
      navigate(`/dashboard`);
    }
  };

  const handleMarkAllAsRead = () => {
    if (user?.id) {
      markAllAsRead(user.id);
    }
  };

  const handleDeleteNotification = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    if (user?.id) {
      deleteNotification(notificationId, user.id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-medium text-sm">{t('notifications.title')}</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck className="h-3 w-3" />
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">{t('notifications.empty')}</p>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((notification) => {
                const Icon = NOTIFICATION_ICONS[notification.type] || Bell;

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors",
                      !notification.read && "bg-primary/5"
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                      notification.type === 'issue_assigned' && "bg-blue-500/10 text-blue-500",
                      notification.type === 'comment_added' && "bg-green-500/10 text-green-500",
                      notification.type === 'status_changed' && "bg-yellow-500/10 text-yellow-500",
                      notification.type === 'due_date_reminder' && "bg-red-500/10 text-red-500",
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm line-clamp-1",
                          !notification.read && "font-medium"
                        )}>
                          {notification.title}
                        </p>
                        <button
                          onClick={(e) => handleDeleteNotification(e, notification.id)}
                          className="hover:text-destructive p-0.5 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.body}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale
                        })}
                      </p>
                    </div>

                    {!notification.read && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => navigate('/notifications')}
              >
                {t('notifications.viewAll')}
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
