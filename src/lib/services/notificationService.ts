import { supabase } from '@/lib/supabase';
import type { Profile, Issue } from '@/types/database';

export type NotificationType =
  | 'issue_assigned'
  | 'issue_mentioned'
  | 'comment_added'
  | 'status_changed'
  | 'due_date_reminder'
  | 'invite_received';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  created_at: string;
}

export interface NotificationWithActor extends Notification {
  actor?: Profile | null;
}

export const notificationService = {
  async getNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return (data || []) as Notification[];
  },

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, any> = {}
  ): Promise<Notification | null> {
    const notification = {
      user_id: userId,
      type,
      title,
      body,
      data,
      read: false,
    };

    const { data: created, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return null;
    }

    return created as Notification;
  },

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting notification:', error);
    }
  },

  async clearAll(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error clearing notifications:', error);
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  },

  // Check for due date reminders
  async checkDueDateReminders(userId: string, issues: Issue[]): Promise<Notification[]> {
    const now = new Date();

    const todayStr = now.toISOString().split('T')[0];
    const { data: existingReminders } = await supabase
      .from('notifications')
      .select('data')
      .eq('user_id', userId)
      .eq('type', 'due_date_reminder')
      .gte('created_at', `${todayStr}T00:00:00Z`);

    const processedIssueIds = new Set<string>();
    if (existingReminders) {
      existingReminders.forEach((n: any) => {
        if (n.data?.issue_id) processedIssueIds.add(n.data.issue_id);
      });
    }

    const notificationsToCreate: Notification[] = [];

    for (const issue of issues) {
      if (!issue.due_date || issue.status === 'done' || issue.status === 'cancelled') {
        continue;
      }

      // Check if user is assignee
      if (issue.assignee_id !== userId) {
        continue;
      }

      // Skip if already reminded today
      if (processedIssueIds.has(issue.id)) continue;

      const dueDate = new Date(issue.due_date);
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let title = '';
      let body = '';
      let data: any = { issue_id: issue.id, issue_identifier: issue.identifier };

      if (diffDays === 0) {
        title = 'Due today';
        body = `"${issue.title}" is due today`;
        data.days_until_due = 0;
      } else if (diffDays === 1) {
        title = 'Due tomorrow';
        body = `"${issue.title}" is due tomorrow`;
        data.days_until_due = 1;
      } else if (diffDays === 3) {
        title = 'Due soon';
        body = `"${issue.title}" is due in 3 days`;
        data.days_until_due = 3;
      } else if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        title = 'Overdue';
        body = `"${issue.title}" is ${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue`;
        data.days_overdue = overdueDays;
      } else {
        continue;
      }

      const notification = await this.createNotification(
        userId,
        'due_date_reminder',
        title,
        body,
        data
      );

      if (notification) {
        notificationsToCreate.push(notification);
      }
    }

    return notificationsToCreate;
  },

  // Subscribe to real-time changes for notifications
  subscribeToIssueChanges(
    teamId: string,
    userId: string,
    onNotification: (notification: Notification) => void
  ) {
    const notificationSubscription = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            onNotification(payload.new as Notification);
          }
        }
      )
      .subscribe();

    // Client-side triggers for Issues/Comments (until migrated entirely to DB triggers)
    const issueSubscription = supabase
      .channel(`issue_changes:${teamId}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'issues',
          filter: `assignee_id=eq.${userId}`,
        },
        async (payload) => {
          const { old: oldRecord, new: newRecord } = payload;
          const oldIssue = oldRecord as any;
          const newIssue = newRecord as any;

          if (oldIssue.assignee_id !== userId && newIssue.assignee_id === userId) {
            await this.createNotification(
              userId,
              'issue_assigned',
              'Issue assigned to you',
              `You have been assigned to "${newIssue.title}"`,
              { issue_id: newIssue.id, issue_identifier: newIssue.identifier }
            );
          }

          if (oldIssue.status !== newIssue.status) {
            await this.createNotification(
              userId,
              'status_changed',
              'Issue status changed',
              `"${newIssue.title}" status changed to ${newIssue.status}`,
              { issue_id: newIssue.id, issue_identifier: newIssue.identifier, status: newIssue.status }
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
        },
        async (payload) => {
          const comment = payload.new as any;

          const { data: issue } = await supabase
            .from('issues')
            .select('*')
            .eq('id', comment.issue_id)
            .single();

          if (issue && (issue.assignee_id === userId || issue.creator_id === userId) && comment.user_id !== userId) {
            await this.createNotification(
              userId,
              'comment_added',
              'New comment',
              `New comment on "${(issue as any).title}"`,
              { issue_id: comment.issue_id, comment_id: comment.id }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationSubscription);
      supabase.removeChannel(issueSubscription);
    };
  },
};
