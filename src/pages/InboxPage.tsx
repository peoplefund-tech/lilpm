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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

export type InboxItemType = 
  | 'issue_assigned'
  | 'issue_mentioned'
  | 'comment_mentioned'
  | 'comment_added'
  | 'prd_mentioned'
  | 'status_changed'
  | 'due_date_reminder';

export interface InboxItem {
  id: string;
  user_id: string;
  type: InboxItemType;
  title: string;
  body: string;
  actor_id?: string;
  actor?: Profile | null;
  entity_type: 'issue' | 'prd' | 'project' | 'comment';
  entity_id: string;
  entity_identifier?: string;
  read: boolean;
  created_at: string;
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
};

const ITEM_TYPE_COLORS: Record<InboxItemType, string> = {
  issue_assigned: 'bg-blue-500/10 text-blue-500',
  issue_mentioned: 'bg-purple-500/10 text-purple-500',
  comment_mentioned: 'bg-purple-500/10 text-purple-500',
  comment_added: 'bg-green-500/10 text-green-500',
  prd_mentioned: 'bg-indigo-500/10 text-indigo-500',
  status_changed: 'bg-yellow-500/10 text-yellow-500',
  due_date_reminder: 'bg-red-500/10 text-red-500',
};

export function InboxPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ko' ? ko : enUS;
  const { user } = useAuthStore();
  
  const [items, setItems] = useState<InboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'mentions'>('all');

  const loadInboxItems = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // Load from localStorage for now (can be migrated to database later)
      const stored = localStorage.getItem(`${INBOX_STORAGE_KEY}_${user.id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as InboxItem[];
        
        // Fetch actor profiles
        const actorIds = [...new Set(parsed.map(i => i.actor_id).filter(Boolean))];
        if (actorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', actorIds);
          
          const profilesMap = new Map((profiles || []).map(p => [p.id, p]));
          
          const enriched = parsed.map(item => ({
            ...item,
            actor: item.actor_id ? profilesMap.get(item.actor_id) || null : null,
          }));
          
          setItems(enriched);
        } else {
          setItems(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load inbox items:', error);
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
    // Mark as read
    if (!item.read && user?.id) {
      const updated = items.map(i => 
        i.id === item.id ? { ...i, read: true } : i
      );
      setItems(updated);
      localStorage.setItem(`${INBOX_STORAGE_KEY}_${user.id}`, JSON.stringify(updated));
    }

    // Navigate to entity
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

  const markAllAsRead = () => {
    if (!user?.id) return;
    const updated = items.map(i => ({ ...i, read: true }));
    setItems(updated);
    localStorage.setItem(`${INBOX_STORAGE_KEY}_${user.id}`, JSON.stringify(updated));
  };

  const deleteItem = (itemId: string) => {
    if (!user?.id) return;
    const updated = items.filter(i => i.id !== itemId);
    setItems(updated);
    localStorage.setItem(`${INBOX_STORAGE_KEY}_${user.id}`, JSON.stringify(updated));
  };

  const clearAll = () => {
    if (!user?.id) return;
    setItems([]);
    localStorage.removeItem(`${INBOX_STORAGE_KEY}_${user.id}`);
  };

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return t('notifications.today', '오늘');
    }
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return t('notifications.yesterday', '어제');
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
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount > 0 
                ? t('inbox.unreadCount', '{{count}}개의 읽지 않은 항목', { count: unreadCount })
                : t('inbox.allRead', '모든 항목을 읽었습니다')
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
                {t('inbox.markAllRead', '모두 읽음')}
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
              {t('inbox.all', '전체')} ({items.length})
            </TabsTrigger>
            <TabsTrigger value="unread">
              {t('inbox.unread', '읽지 않음')} ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="mentions" className="gap-1">
              <AtSign className="h-3 w-3" />
              {t('inbox.mentions', '멘션')} ({mentionCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {filter === 'unread' 
                  ? t('inbox.noUnread', '읽지 않은 항목이 없습니다')
                  : filter === 'mentions'
                  ? t('inbox.noMentions', '멘션된 항목이 없습니다')
                  : t('inbox.empty', '인박스가 비어있습니다')
                }
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {t('inbox.emptyDescription', '이슈 할당, 멘션, 댓글 등의 알림이 여기에 표시됩니다.')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([date, dateItems]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">
                  {getDateLabel(date)}
                </h3>
                <Card>
                  <CardContent className="p-0 divide-y">
                    {dateItems.map((item) => {
                      const Icon = ITEM_TYPE_ICONS[item.type] || Inbox;
                      const colorClass = ITEM_TYPE_COLORS[item.type] || 'bg-muted text-muted-foreground';
                      
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer group",
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
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {item.body}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
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
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteItem(item.id);
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
                  {t('inbox.clearAll', '모두 삭제')}
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
