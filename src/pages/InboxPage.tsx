import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, format } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Inbox,
  User,
  MessageSquare,
  AtSign,
  AlertCircle,
  Clock,
  CheckCheck,
  Trash2,
  Settings,
  FileText,
  FolderKanban,
  Loader2,
  Users,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api/client';
import { notificationService } from '@/lib/services/notificationService';
import { teamInviteService } from '@/lib/services';
import { toast } from 'sonner';
import type { Profile } from '@/types/database';

export type InboxItemType =
  | 'issue_assigned'
  | 'issue_mentioned'
  | 'comment_mentioned'
  | 'comment_added'
  | 'prd_mentioned'
  | 'status_changed'
  | 'due_date_reminder'
  | 'team_invite'
  | 'invite_accepted'
  | 'invite_rejected';

export interface InboxItem {
  id: string;
  user_id: string;
  type: InboxItemType;
  title: string;
  message?: string; // Changed from body
  body?: string; // For backward compatibility
  actor_id?: string;
  actor?: Profile | null;
  entity_type?: 'issue' | 'prd' | 'project' | 'comment';
  entity_id?: string;
  entity_identifier?: string;
  read: boolean;
  created_at: string;
  data?: any; // For invite tokens and other metadata
}

const INBOX_STORAGE_KEY = 'lily-inbox';

const ITEM_TYPE_ICONS: Record<InboxItemType, React.ElementType> = {
  issue_assigned: User,
  issue_mentioned: AtSign,
  comment_mentioned: AtSign,
  comment_added: MessageSquare,
  prd_mentioned: FileText,
  status_changed: AlertCircle,
  due_date_reminder: Clock,
  team_invite: Users,
  invite_accepted: CheckCheck,
  invite_rejected: X,
};

const ITEM_TYPE_COLORS: Record<InboxItemType, string> = {
  issue_assigned: 'bg-blue-500/10 text-blue-500',
  issue_mentioned: 'bg-purple-500/10 text-purple-500',
  comment_mentioned: 'bg-purple-500/10 text-purple-500',
  comment_added: 'bg-green-500/10 text-green-500',
  prd_mentioned: 'bg-indigo-500/10 text-indigo-500',
  status_changed: 'bg-yellow-500/10 text-yellow-500',
  due_date_reminder: 'bg-red-500/10 text-red-500',
  team_invite: 'bg-cyan-500/10 text-cyan-500',
  invite_accepted: 'bg-green-500/10 text-green-500',
  invite_rejected: 'bg-red-500/10 text-red-500',
};

export function InboxPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ko' ? ko : enUS;
  const { user } = useAuthStore();

  const [items, setItems] = useState<InboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'mentions'>('all');
  const [inviteValidity, setInviteValidity] = useState<Record<string, { valid: boolean; status: string }>>({});

  const loadInboxItems = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Load notifications from API
      const response = await notificationService.getNotifications(user.id, {
        limit: 100,
      });

      const notifications = response.notifications;

      if (notifications && notifications.length > 0) {
        const enriched = notifications.map((notif: any) => ({
          id: notif.id,
          user_id: notif.user_id,
          type: notif.type as InboxItemType,
          title: notif.title,
          message: notif.body || notif.message,
          body: notif.body || notif.message, // For backward compatibility
          actor_id: notif.actor_id,
          actor: notif.actor || null,
          entity_type: notif.entity_type,
          entity_id: notif.entity_id,
          entity_identifier: notif.entity_identifier,
          read: notif.read || false,
          created_at: notif.created_at,
          data: notif.data,
        }));

        setItems(enriched);

        // Check validity of team invites
        const teamInviteItems = enriched.filter(item => item.type === 'team_invite' && item.data?.token);
        if (teamInviteItems.length > 0) {
          const validityChecks = await Promise.all(
            teamInviteItems.map(async (item) => {
              const result = await teamInviteService.checkInviteValidity(item.data.token);
              return { id: item.id, ...result };
            })
          );
          const validityMap = validityChecks.reduce((acc, check) => {
            acc[check.id] = { valid: check.valid, status: check.status };
            return acc;
          }, {} as Record<string, { valid: boolean; status: string }>);
          setInviteValidity(validityMap);
        }
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Failed to load inbox items:', error);
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadInboxItems();
  }, [loadInboxItems]);

  const unreadCount = items.filter(i => !i.read).length;
  const mentionCount = items.filter(i =>
    ['issue_mentioned', 'comment_mentioned', 'prd_mentioned'].includes(i.type)
  ).length;

  const filteredItems = items.filter(item => {
    if (filter === 'unread') return !item.read;
    if (filter === 'mentions') {
      return ['issue_mentioned', 'comment_mentioned', 'prd_mentioned'].includes(item.type);
    }
    return true;
  });

  const groupedItems = filteredItems.reduce((groups, item) => {
    const date = format(new Date(item.created_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {} as Record<string, InboxItem[]>);

  const handleItemClick = async (item: InboxItem) => {
    // Don't navigate for team_invite type - handled by buttons
    if (item.type === 'team_invite') {
      // Mark as read but don't navigate
      if (!item.read && user?.id) {
        await markAsRead(item.id);
      }
      return;
    }

    // Mark as read
    if (!item.read && user?.id) {
      await markAsRead(item.id);
    }

    // Navigate to entity
    if (!item.entity_type || !item.entity_id) return;

    switch (item.entity_type) {
      case 'issue':
        navigate(`/issue/${item.entity_id}`);
        break;
      case 'prd':
        navigate(`/prd/${item.entity_id}`);
        break;
      case 'project':
        navigate(`/project/${item.entity_id}`);
        break;
      case 'comment':
        // Comments link to their parent issue
        navigate(`/issue/${item.entity_id}`);
        break;
    }
  };

  const markAsRead = async (itemId: string) => {
    try {
      await notificationService.markAsRead(itemId);

      setItems(prev => prev.map(i =>
        i.id === itemId ? { ...i, read: true } : i
      ));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleAcceptInvite = async (item: InboxItem) => {
    if (!item.data?.token) {
      toast.error('Invalid invite token');
      return;
    }

    try {
      await teamInviteService.acceptInvite(item.data.token);
      toast.success(`You've joined ${item.data.teamName}!`);

      // Remove or update the notification
      await deleteItem(item.id);

      // Reload to refresh teams
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept invite');
    }
  };

  const handleRejectInvite = async (item: InboxItem) => {
    if (!item.data?.token) {
      toast.error('Invalid invite token');
      return;
    }

    try {
      await teamInviteService.rejectInvite(item.data.token);
      toast.success('Invite declined');

      // Remove the notification
      await deleteItem(item.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to decline invite');
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      await notificationService.markAllAsRead();

      setItems(prev => prev.map(i => ({ ...i, read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteItem = async (itemId: string, item?: InboxItem) => {
    try {
      // If this is a team invite, auto-decline it first
      if (item?.type === 'team_invite' && item.data?.token) {
        try {
          await teamInviteService.rejectInvite(item.data.token);
        } catch (declineError) {
          console.log('Invite may already be declined:', declineError);
        }
      }

      const res = await apiClient.delete(`/notifications/${itemId}`);

      if (res.error) {
        throw new Error(res.error);
      }

      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const clearAll = async () => {
    if (!user?.id) return;

    try {
      const res = await apiClient.delete('/notifications');

      if (res.error) {
        throw new Error(res.error);
      }

      setItems([]);
      toast.success('All notifications cleared');
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      toast.error('Failed to clear notifications');
    }
  };

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return t('notifications.today');
    }
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return t('notifications.yesterday');
    }
    return format(date, 'PPP', { locale });
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Inbox className="h-5 w-5 sm:h-6 sm:w-6" />
              {t('nav.inbox')}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {unreadCount > 0
                ? t('inbox.unreadCount', { count: unreadCount })
                : t('inbox.allRead')
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-4 w-4" />
                {t('inbox.markAllRead')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings/notifications')}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">
              {t('inbox.all')} ({items.length})
            </TabsTrigger>
            <TabsTrigger value="unread">
              {t('inbox.unread')} ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="mentions" className="gap-1">
              <AtSign className="h-3 w-3" />
              {t('inbox.mentions')} ({mentionCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Inbox className="h-12 w-12 text-slate-400/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {filter === 'unread'
                  ? t('inbox.noUnread')
                  : filter === 'mentions'
                    ? t('inbox.noMentions')
                    : t('inbox.empty')
                }
              </h3>
              <p className="text-sm text-slate-400 text-center max-w-md">
                {t('inbox.emptyDescription')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([date, dateItems]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-slate-400 mb-3 px-1">
                  {getDateLabel(date)}
                </h3>
                <Card>
                  <CardContent className="p-0 divide-y">
                    {dateItems.map((item) => {
                      const Icon = ITEM_TYPE_ICONS[item.type] || Inbox;
                      const colorClass = ITEM_TYPE_COLORS[item.type] || 'bg-[#1a1a1f] text-slate-400';

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-start gap-3 p-4 hover:bg-white/5 transition-colors cursor-pointer group",
                            !item.read && "bg-primary/5"
                          )}
                          onClick={() => handleItemClick(item)}
                        >
                          <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                            colorClass
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {item.actor && (
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={item.actor.avatar_url || undefined} />
                                      <AvatarFallback className="text-xs">
                                        {item.actor.name?.charAt(0) || '?'}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                  <p className={cn(
                                    "text-sm",
                                    !item.read && "font-medium"
                                  )}>
                                    {item.title}
                                  </p>
                                </div>
                                <p className="text-sm text-slate-400 line-clamp-2">
                                  {item.message || item.body}
                                </p>

                                {/* Team Invite Actions */}
                                {item.type === 'team_invite' && (
                                  <div className="flex items-center gap-2 mt-3">
                                    {inviteValidity[item.id]?.valid === false ? (
                                      <>
                                        <Badge variant="secondary" className="bg-red-500/10 text-red-500">
                                          {inviteValidity[item.id]?.status === 'expired' ? 'Expired' :
                                            inviteValidity[item.id]?.status === 'cancelled' ? 'Cancelled' :
                                              inviteValidity[item.id]?.status === 'accepted' ? 'Already Accepted' :
                                                inviteValidity[item.id]?.status === 'rejected' ? 'Already Declined' :
                                                  'Unavailable'}
                                        </Badge>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="gap-2 text-slate-400 hover:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteItem(item.id);
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          Delete
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          size="sm"
                                          className="gap-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAcceptInvite(item);
                                          }}
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                          Accept
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRejectInvite(item);
                                          }}
                                        >
                                          <X className="h-3.5 w-3.5" />
                                          Decline
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-slate-400 whitespace-nowrap">
                                  {formatDistanceToNow(new Date(item.created_at), {
                                    addSuffix: true,
                                    locale
                                  })}
                                </span>
                                {!item.read && (
                                  <div className="h-2 w-2 rounded-full bg-primary" />
                                )}
                              </div>
                            </div>

                            {item.entity_identifier && (
                              <Badge variant="outline" className="mt-2 text-xs">
                                {item.entity_identifier}
                              </Badge>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteItem(item.id, item);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            ))}

            {/* Clear All */}
            {items.length > 0 && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={clearAll}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('inbox.clearAll')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// Helper function to add inbox items (for use in other components)
export function addInboxItem(userId: string, item: Omit<InboxItem, 'id' | 'created_at' | 'read'>) {
  const stored = localStorage.getItem(`${INBOX_STORAGE_KEY}_${userId}`);
  const items: InboxItem[] = stored ? JSON.parse(stored) : [];

  const newItem: InboxItem = {
    ...item,
    id: crypto.randomUUID(),
    read: false,
    created_at: new Date().toISOString(),
  };

  items.unshift(newItem);

  // Keep only last 100 items
  const trimmed = items.slice(0, 100);
  localStorage.setItem(`${INBOX_STORAGE_KEY}_${userId}`, JSON.stringify(trimmed));

  return newItem;
}
