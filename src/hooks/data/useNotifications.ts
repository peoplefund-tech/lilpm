/**
 * React Query hooks for notifications
 * Provides caching, automatic refetching, and optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './useQueryKeys';
import { supabase } from '@/lib/supabase';

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

/** Fetch notifications from Supabase notifications table */
async function fetchNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []) as NotificationRow[];
}

/** Fetch unread count only (lightweight query) */
async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
  return count || 0;
}

/**
 * Hook to fetch user notifications with caching
 * Stale time: 1 minute, refetches on window focus
 */
export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications.all(userId || ''),
    queryFn: () => fetchNotifications(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 30 * 1000, // Poll every 30 seconds
  });
}

/**
 * Hook to fetch unread notification count (lightweight)
 * Polls frequently for badge updates
 */
export function useUnreadNotificationCount(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications.unread(userId || ''),
    queryFn: () => fetchUnreadCount(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 15 * 1000, // Poll every 15 seconds
  });
}

/**
 * Mutation to mark a notification as read
 * Uses optimistic update for instant UI feedback
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationId, userId }: { notificationId: string; userId: string }) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onMutate: async ({ notificationId, userId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all(userId) });

      // Snapshot previous value
      const previousNotifications = queryClient.getQueryData<NotificationRow[]>(
        queryKeys.notifications.all(userId)
      );

      // Optimistic update
      if (previousNotifications) {
        queryClient.setQueryData<NotificationRow[]>(
          queryKeys.notifications.all(userId),
          previousNotifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          )
        );
      }

      // Optimistic unread count update
      queryClient.setQueryData<number>(
        queryKeys.notifications.unread(userId),
        (prev) => Math.max((prev || 0) - 1, 0)
      );

      return { previousNotifications };
    },
    onError: (_err, { userId }, context) => {
      // Revert on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          queryKeys.notifications.all(userId),
          context.previousNotifications
        );
      }
    },
    onSettled: (_data, _error, { userId }) => {
      // Refetch to sync
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread(userId) });
    },
  });
}

/**
 * Mutation to mark all notifications as read
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
      if (error) throw error;
    },
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all(userId) });

      const previousNotifications = queryClient.getQueryData<NotificationRow[]>(
        queryKeys.notifications.all(userId)
      );

      // Optimistic: mark all as read
      if (previousNotifications) {
        queryClient.setQueryData<NotificationRow[]>(
          queryKeys.notifications.all(userId),
          previousNotifications.map((n) => ({ ...n, read: true }))
        );
      }
      queryClient.setQueryData<number>(queryKeys.notifications.unread(userId), 0);

      return { previousNotifications };
    },
    onError: (_err, userId, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          queryKeys.notifications.all(userId),
          context.previousNotifications
        );
      }
    },
    onSettled: (_data, _error, userId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread(userId) });
    },
  });
}
