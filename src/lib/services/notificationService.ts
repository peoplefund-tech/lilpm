import { apiClient } from '@/lib/api/client';
import type { Profile, Issue } from '@/types/database';

export type NotificationType =
  | 'issue_assigned'
  | 'issue_mentioned'
  | 'comment_added'
  | 'status_changed'
  | 'due_date_reminder'
  | 'invite_accepted'
  | 'invite_rejected'
  | 'invite_expired'
  | 'prd_created'
  | 'issue_created'
  | 'mention_notification';

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

export interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
  limit: number;
  offset: number;
}

export const notificationService = {
  async getNotifications(
    userId: string,
    options?: {
      teamId?: string;
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    }
  ): Promise<NotificationResponse> {
    const queryParams = new URLSearchParams();

    if (options?.teamId) {
      queryParams.append('teamId', options.teamId);
    }
    if (options?.limit) {
      queryParams.append('limit', String(options.limit));
    }
    if (options?.offset) {
      queryParams.append('offset', String(options.offset));
    }
    if (options?.unreadOnly) {
      queryParams.append('unreadOnly', 'true');
    }

    const endpoint = `/notifications${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const res = await apiClient.get<NotificationResponse>(endpoint);

    if (res.error) {
      throw new Error(res.error);
    }

    return res.data;
  },

  async markAsRead(notificationId: string): Promise<void> {
    const res = await apiClient.patch(`/notifications/${notificationId}/read`);

    if (res.error) {
      throw new Error(res.error);
    }
  },

  async markAllAsRead(teamId?: string): Promise<void> {
    const queryParams = new URLSearchParams();

    if (teamId) {
      queryParams.append('teamId', teamId);
    }

    const endpoint = `/notifications/read-all${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const res = await apiClient.post<{ success: boolean }>(endpoint);

    if (res.error) {
      throw new Error(res.error);
    }
  },

  // Check for due date reminders
  // Note: This is typically called by a backend job or timer
  // Client-side implementation kept for backwards compatibility
  async checkDueDateReminders(userId: string, issues: Issue[]): Promise<Notification[]> {
    const now = new Date();
    const notificationsToCreate: Notification[] = [];

    // Fetch existing notifications to check if reminders were already sent
    try {
      const response = await this.getNotifications(userId, {
        unreadOnly: false,
        limit: 100,
      });
      const existingNotifications = response.notifications;

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
          notificationsToCreate.push({
            id: crypto.randomUUID(),
            user_id: userId,
            type: 'due_date_reminder',
            title: 'Due today',
            body: `"${issue.title}" is due today`,
            data: { issue_id: issue.id, issue_identifier: issue.identifier, days_until_due: 0 },
            read: false,
            created_at: new Date().toISOString(),
          });
        }
        // Due tomorrow
        else if (diffDays === 1) {
          notificationsToCreate.push({
            id: crypto.randomUUID(),
            user_id: userId,
            type: 'due_date_reminder',
            title: 'Due tomorrow',
            body: `"${issue.title}" is due tomorrow`,
            data: { issue_id: issue.id, issue_identifier: issue.identifier, days_until_due: 1 },
            read: false,
            created_at: new Date().toISOString(),
          });
        }
        // Due in 3 days
        else if (diffDays === 3) {
          notificationsToCreate.push({
            id: crypto.randomUUID(),
            user_id: userId,
            type: 'due_date_reminder',
            title: 'Due soon',
            body: `"${issue.title}" is due in 3 days`,
            data: { issue_id: issue.id, issue_identifier: issue.identifier, days_until_due: 3 },
            read: false,
            created_at: new Date().toISOString(),
          });
        }
        // Overdue
        else if (diffDays < 0) {
          const overdueDays = Math.abs(diffDays);
          notificationsToCreate.push({
            id: crypto.randomUUID(),
            user_id: userId,
            type: 'due_date_reminder',
            title: 'Overdue',
            body: `"${issue.title}" is ${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue`,
            data: { issue_id: issue.id, issue_identifier: issue.identifier, days_overdue: overdueDays },
            read: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to check due date reminders:', error);
    }

    return notificationsToCreate;
  },

  // Subscribe to real-time changes for notifications
  // TODO: Migrate to WebSocket connection to collab-server
  // This maintains backwards compatibility but should be replaced with WebSocket
  subscribeToIssueChanges(
    teamId: string,
    userId: string,
    onNotification: (notification: Notification) => void
  ) {
    // TODO: Replace with WebSocket subscription to collab-server
    // For now, return a no-op unsubscribe function
    // Real-time notifications will be handled via server push or polling

    return () => {
      // No-op cleanup
    };
  },
};
