/**
 * Supabase Realtime Collaboration Hook
 * 
 * Uses Supabase Realtime Broadcast for cursor sync and Presence for user tracking.
 * Guarantees DB persistence while providing real-time collaboration features.
 * 
 * This is a reliable fallback/replacement for WebSocket-based Yjs sync.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenceUser {
    id: string;
    name: string;
    color: string;
    avatar?: string;
    cursorPosition?: number;
    blockId?: string;
    lastSeen: number;
}

export interface UseSupabaseCollaborationOptions {
    entityType: 'prd' | 'issue';
    entityId: string;
    userId: string;
    userName: string;
    userColor?: string;
    avatarUrl?: string;
    enabled?: boolean;
}

export interface UseSupabaseCollaborationReturn {
    isConnected: boolean;
    presenceUsers: PresenceUser[];
    updateCursorPosition: (position: number, blockId?: string) => void;
    broadcastContentChange: (content: string) => void;
    onRemoteContentChange: (callback: (content: string, userId: string) => void) => void;
}

function getRandomColor(): string {
    const colors = [
        '#F87171', '#FB923C', '#FBBF24', '#4ADE80', '#22D3EE',
        '#60A5FA', '#A78BFA', '#F472B6', '#94A3B8'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

export function useSupabaseCollaboration(
    options: UseSupabaseCollaborationOptions
): UseSupabaseCollaborationReturn {
    const {
        entityType,
        entityId,
        userId,
        userName,
        userColor = getRandomColor(),
        avatarUrl,
        enabled = true,
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const contentChangeCallbackRef = useRef<((content: string, userId: string) => void) | null>(null);

    const roomName = useMemo(() => `collab:${entityType}:${entityId}`, [entityType, entityId]);

    // Update cursor position
    const updateCursorPosition = useCallback((position: number, blockId?: string) => {
        if (!channelRef.current) return;

        // Update presence with cursor info
        channelRef.current.track({
            id: userId,
            name: userName,
            color: userColor,
            avatar: avatarUrl,
            cursorPosition: position,
            blockId,
            lastSeen: Date.now(),
        });
    }, [userId, userName, userColor, avatarUrl]);

    // Broadcast content change to other users
    const broadcastContentChange = useCallback((content: string) => {
        if (!channelRef.current) return;

        channelRef.current.send({
            type: 'broadcast',
            event: 'content_change',
            payload: {
                content,
                userId,
                timestamp: Date.now(),
            },
        });
    }, [userId]);

    // Register callback for remote content changes
    const onRemoteContentChange = useCallback((callback: (content: string, userId: string) => void) => {
        contentChangeCallbackRef.current = callback;
    }, []);

    // Setup channel
    useEffect(() => {
        if (!enabled || !entityId || !userId) {
            return;
        }

        console.log('[SupabaseCollaboration] Setting up channel:', roomName);

        const channel = supabase.channel(roomName, {
            config: {
                presence: {
                    key: userId,
                },
            },
        });

        // Handle presence sync
        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const users: PresenceUser[] = [];

            Object.values(state).forEach((presences: any[]) => {
                presences.forEach((presence) => {
                    if (presence.id !== userId) {
                        users.push({
                            id: presence.id,
                            name: presence.name,
                            color: presence.color,
                            avatar: presence.avatar,
                            cursorPosition: presence.cursorPosition,
                            blockId: presence.blockId,
                            lastSeen: presence.lastSeen || Date.now(),
                        });
                    }
                });
            });

            console.log('[SupabaseCollaboration] Presence sync, users:', users.length);
            setPresenceUsers(users);
        });

        // Handle presence join
        channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('[SupabaseCollaboration] User joined:', key);
        });

        // Handle presence leave
        channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('[SupabaseCollaboration] User left:', key);
            setPresenceUsers((prev) => prev.filter((u) => u.id !== key));
        });

        // Handle content change broadcasts from other users
        channel.on('broadcast', { event: 'content_change' }, ({ payload }) => {
            console.log('[SupabaseCollaboration] Received content_change broadcast:', {
                fromUserId: payload.userId,
                currentUserId: userId,
                isSelf: payload.userId === userId,
                hasCallback: !!contentChangeCallbackRef.current,
                contentLength: payload.content?.length,
            });
            if (payload.userId !== userId && contentChangeCallbackRef.current) {
                console.log('[SupabaseCollaboration] Applying remote content change from:', payload.userId);
                contentChangeCallbackRef.current(payload.content, payload.userId);
            } else if (payload.userId !== userId && !contentChangeCallbackRef.current) {
                console.warn('[SupabaseCollaboration] No callback registered for content change!');
            }
        });

        // Subscribe to channel
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log('[SupabaseCollaboration] Connected to:', roomName);
                setIsConnected(true);

                // Track initial presence
                await channel.track({
                    id: userId,
                    name: userName,
                    color: userColor,
                    avatar: avatarUrl,
                    lastSeen: Date.now(),
                });
            } else if (status === 'CHANNEL_ERROR') {
                console.error('[SupabaseCollaboration] Channel error');
                setIsConnected(false);
            } else if (status === 'TIMED_OUT') {
                console.warn('[SupabaseCollaboration] Channel timed out');
                setIsConnected(false);
            }
        });

        channelRef.current = channel;

        return () => {
            console.log('[SupabaseCollaboration] Cleanup:', roomName);
            channel.unsubscribe();
            channelRef.current = null;
            setIsConnected(false);
            setPresenceUsers([]);
        };
    }, [enabled, entityId, userId, userName, userColor, avatarUrl, roomName]);

    return {
        isConnected,
        presenceUsers,
        updateCursorPosition,
        broadcastContentChange,
        onRemoteContentChange,
    };
}
