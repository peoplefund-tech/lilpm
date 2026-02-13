import { create } from 'zustand';
import { notificationService, type Notification } from '@/lib/services/notificationService';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  
  // Actions
  loadNotifications: (userId: string) => Promise<void>;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string, userId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  deleteNotification: (notificationId: string, userId: string) => Promise<void>;
  clearAll: (userId: string) => Promise<void>;
  updateUnreadCount: (userId: string) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  loadNotifications: async (userId: string) => {
    set({ isLoading: true });
    try {
      const response = await notificationService.getNotifications(userId, { limit: 50 });
      set({ notifications: response.notifications, unreadCount: response.unreadCount, isLoading: false });
    } catch (error) {
      console.error('Failed to load notifications:', error);
      set({ isLoading: false });
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAsRead: async (notificationId: string, userId: string) => {
    await notificationService.markAsRead(notificationId);
    set((state) => ({
      notifications: state.notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllAsRead: async (userId: string) => {
    await notificationService.markAllAsRead();
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  deleteNotification: async (notificationId: string, userId: string) => {
    // Note: Server API does not support deletion yet
    // This removes from local state only for UX
    const notification = get().notifications.find(n => n.id === notificationId);
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== notificationId),
      unreadCount: notification && !notification.read
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }));
  },

  clearAll: async (userId: string) => {
    // Note: Server API does not support clear all yet
    // Use markAllAsRead instead to clear unread status
    await notificationService.markAllAsRead();
    set({ notifications: [], unreadCount: 0 });
  },

  updateUnreadCount: async (userId: string) => {
    // Fetch fresh data to get accurate unread count
    try {
      const response = await notificationService.getNotifications(userId, { unreadOnly: true });
      set({ unreadCount: response.unreadCount });
    } catch (error) {
      console.error('Failed to update unread count:', error);
    }
  },
}));
