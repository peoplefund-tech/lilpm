import React, { useEffect, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Bell,
  User,
  MessageSquare,
  AlertCircle,
  Clock,
  CheckCheck,
  Trash2,
  Settings,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import type { NotificationType } from '@/lib/services/notificationService';

const NOTIFICATION_ICONS: Record<NotificationType, React.ElementType> = {
  issue_assigned: User,
  issue_mentioned: MessageSquare,
  comment_added: MessageSquare,
  status_changed: AlertCircle,
  due_date_reminder: Clock,
};

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  issue_assigned: 'bg-blue-500/10 text-blue-500',
  issue_mentioned: 'bg-purple-500/10 text-purple-500',
  comment_added: 'bg-green-500/10 text-green-500',
  status_changed: 'bg-yellow-500/10 text-yellow-500',
  due_date_reminder: 'bg-red-500/10 text-red-500',
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ko' ? ko : enUS;
  const { user } = useAuthStore();
  const { 
    notifications, 
    unreadCount, 
    loadNotifications, 
    markAsRead, 
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotificationStore();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (user?.id) {
      loadNotifications(user.id);
    }
  }, [user?.id, loadNotifications]);

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = format(new Date(notification.created_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(notification);
    return groups;
  }, {} as Record<string, typeof notifications>);

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (user?.id && !notification.read) {
      await markAsRead(notification.id, user.id);
    }

    if (notification.data?.issue_id) {
      navigate(`/issue/${notification.data.issue_id}`);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map(n => n.id));
    }
  };

  const handleBulkMarkAsRead = async () => {
    if (!user?.id) return;
    for (const id of selectedIds) {
      await markAsRead(id, user.id);
    }
    setSelectedIds([]);
  };

  const handleBulkDelete = async () => {
    if (!user?.id) return;
    for (const id of selectedIds) {
      await deleteNotification(id, user.id);
    }
    setSelectedIds([]);
  };

  const handleClearAll = async () => {
    if (!user?.id) return;
    await clearAll(user.id);
    setSelectedIds([]);
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
              <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
              {t('notifications.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount > 0 
                ? t('notifications.unreadCount', { count: unreadCount })
                : t('notifications.allRead')
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 flex-1 sm:flex-none"
                onClick={() => user?.id && markAllAsRead(user.id)}
              >
                <CheckCheck className="h-4 w-4" />
                <span className="sm:inline">{t('notifications.markAllRead')}</span>
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

        {/* Filters & Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
                  <TabsList>
                    <TabsTrigger value="all">
                      {t('notifications.all')} ({notifications.length})
                    </TabsTrigger>
                    <TabsTrigger value="unread">
                      {t('notifications.unreadTab')} ({unreadCount})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t('notifications.selected', { count: selectedIds.length })}
                  </span>
                  <Button size="sm" variant="outline" onClick={handleBulkMarkAsRead}>
                    <CheckCheck className="h-4 w-4 mr-1" />
                    {t('notifications.markRead')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t('common.delete')}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {filter === 'unread' 
                  ? t('notifications.noUnread')
                  : t('notifications.empty')
                }
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {t('notifications.emptyDescription')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Select All */}
            <div className="flex items-center gap-3 px-1">
              <Checkbox
                checked={selectedIds.length === filteredNotifications.length && filteredNotifications.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                {t('notifications.selectAll')}
              </span>
            </div>

            {/* Grouped by Date */}
            {Object.entries(groupedNotifications).map(([date, dateNotifications]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">
                  {getDateLabel(date)}
                </h3>
                <Card>
                  <CardContent className="p-0 divide-y">
                    {dateNotifications.map((notification) => {
                      const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
                      const colorClass = NOTIFICATION_COLORS[notification.type] || 'bg-muted text-muted-foreground';
                      
                      return (
                        <div
                          key={notification.id}
                          className={cn(
                            "flex items-start gap-2 sm:gap-4 p-3 sm:p-4 hover:bg-muted/50 transition-colors cursor-pointer",
                            !notification.read && "bg-primary/5"
                          )}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <Checkbox
                            checked={selectedIds.includes(notification.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedIds([...selectedIds, notification.id]);
                              } else {
                                setSelectedIds(selectedIds.filter(id => id !== notification.id));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1"
                          />
                          
                          <div className={cn(
                            "h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0",
                            colorClass
                          )}>
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-sm line-clamp-2",
                                  !notification.read && "font-medium"
                                )}>
                                  {notification.title}
                                </p>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-1">
                                  {notification.body}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDistanceToNow(new Date(notification.created_at), { 
                                    addSuffix: true, 
                                    locale 
                                  })}
                                </span>
                                {!notification.read && (
                                  <div className="h-2 w-2 rounded-full bg-primary" />
                                )}
                              </div>
                            </div>
                            
                            {notification.data?.issue_identifier && (
                              <Badge variant="outline" className="mt-2 text-xs">
                                {notification.data.issue_identifier as string}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            ))}

            {/* Clear All */}
            {notifications.length > 0 && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleClearAll}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('notifications.clearAll')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
