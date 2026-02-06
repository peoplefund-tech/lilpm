import { supabase } from '@/lib/supabase';
import type { Profile, Issue } from '@/types/database';

export type NotificationType = 
  | 'issue_assigned'
  | 'issue_mentioned'
  | 'comment_added'
  | 'status_changed'
  | 'due_date_reminder';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface NotificationWithActor extends Notification {
  actor?: Profile | null;
}

// Note: This service uses local state since we don't have a notifications table yet
// In production, you would create a notifications table in Supabase

let localNotifications: Notification[] = [];

export const notificationService = {
  async getNotifications(userId: string): Promise<Notification[]> {
    // For now, return from local storage or mock data
    const stored = localStorage.getItem(`notifications_${userId}`);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  },

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, unknown> = {}
  ): Promise<Notification> {
    const notification: Notification = {
      id: crypto.randomUUID(),
      user_id: userId,
      type,
      title,
      body,
      data,
      read: false,
      created_at: new Date().toISOString(),
    };

    // Store in local storage
    const stored = localStorage.getItem(`notifications_${userId}`);
    const notifications = stored ? JSON.parse(stored) : [];
    notifications.unshift(notification);
    
    // Keep only last 50 notifications
    const trimmed = notifications.slice(0, 50);
    localStorage.setItem(`notifications_${userId}`, JSON.stringify(trimmed));

    return notification;
  },

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const stored = localStorage.getItem(`notifications_${userId}`);
    if (stored) {
      const notifications = JSON.parse(stored);
      const updated = notifications.map((n: Notification) => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(updated));
    }
  },

  async markAllAsRead(userId: string): Promise<void> {
    const stored = localStorage.getItem(`notifications_${userId}`);
    if (stored) {
      const notifications = JSON.parse(stored);
      const updated = notifications.map((n: Notification) => ({ ...n, read: true }));
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(updated));
    }
  },

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const stored = localStorage.getItem(`notifications_${userId}`);
    if (stored) {
      const notifications = JSON.parse(stored);
      const updated = notifications.filter((n: Notification) => n.id !== notificationId);
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(updated));
    }
  },

  async clearAll(userId: string): Promise<void> {
    localStorage.removeItem(`notifications_${userId}`);
  },

  getUnreadCount(userId: string): number {
    const stored = localStorage.getItem(`notifications_${userId}`);
    if (stored) {
      const notifications = JSON.parse(stored);
      return notifications.filter((n: Notification) => !n.read).length;
    }
    return 0;
  },

  // Check for due date reminders
  async checkDueDateReminders(userId: string, issues: Issue[]): Promise<Notification[]> {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const notificationsToCreate: Notification[] = [];
    const stored = localStorage.getItem(`notifications_${userId}`);
    const existingNotifications: Notification[] = stored ? JSON.parse(stored) : [];
    
    for (const issue of issues) {
      if (!issue.due_date || issue.status === 'done' || issue.status === 'cancelled') {
        continue;
      }
      
      // Check if user is assignee
      if (issue.assignee_id !== userId) {
        continue;
      }
      
      const dueDate = new Date(issue.due_date);
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if we already sent a reminder for this issue today
      const alreadySent = existingNotifications.some(n => 
        n.type === 'due_date_reminder' && 
        n.data?.issue_id === issue.id &&
        new Date(n.created_at).toDateString() === now.toDateString()
      );
      
      if (alreadySent) continue;
      
      // Due today
      if (diffDays === 0) {
        const notification = await this.createNotification(
          userId,
          'due_date_reminder',
          'Due today',
          `"${issue.title}" is due today`,
          { issue_id: issue.id, issue_identifier: issue.identifier, days_until_due: 0 }
        );
        notificationsToCreate.push(notification);
      }
      // Due tomorrow
      else if (diffDays === 1) {
        const notification = await this.createNotification(
          userId,
          'due_date_reminder',
          'Due tomorrow',
          `"${issue.title}" is due tomorrow`,
          { issue_id: issue.id, issue_identifier: issue.identifier, days_until_due: 1 }
        );
        notificationsToCreate.push(notification);
      }
      // Due in 3 days
      else if (diffDays === 3) {
        const notification = await this.createNotification(
          userId,
          'due_date_reminder',
          'Due soon',
          `"${issue.title}" is due in 3 days`,
          { issue_id: issue.id, issue_identifier: issue.identifier, days_until_due: 3 }
        );
        notificationsToCreate.push(notification);
      }
      // Overdue
      else if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        const notification = await this.createNotification(
          userId,
          'due_date_reminder',
          'Overdue',
          `"${issue.title}" is ${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue`,
          { issue_id: issue.id, issue_identifier: issue.identifier, days_overdue: overdueDays }
        );
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
    const channel = supabase
      .channel(`notifications:${teamId}:${userId}`)
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

          // Check if this user was just assigned
          if (oldIssue.assignee_id !== userId && newIssue.assignee_id === userId) {
            const notification = await notificationService.createNotification(
              userId,
              'issue_assigned',
              'Issue assigned to you',
              `You have been assigned to "${newIssue.title}"`,
              { issue_id: newIssue.id, issue_identifier: newIssue.identifier }
            );
            onNotification(notification);
          }

          // Check if status changed on assigned issue
          if (oldIssue.status !== newIssue.status) {
            const notification = await notificationService.createNotification(
              userId,
              'status_changed',
              'Issue status changed',
              `"${newIssue.title}" status changed to ${newIssue.status}`,
              { issue_id: newIssue.id, issue_identifier: newIssue.identifier, status: newIssue.status }
            );
            onNotification(notification);
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
          
          // Get the issue to check if user is assignee or creator
          const { data: issue } = await supabase
            .from('issues')
            .select('*')
            .eq('id', comment.issue_id)
            .single();

          if (issue && (issue.assignee_id === userId || issue.creator_id === userId) && comment.user_id !== userId) {
            const notification = await notificationService.createNotification(
              userId,
              'comment_added',
              'New comment',
              `New comment on "${(issue as any).title}"`,
              { issue_id: comment.issue_id, comment_id: comment.id }
            );
            onNotification(notification);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
