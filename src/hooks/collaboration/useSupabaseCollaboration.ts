/**
 * Collaboration Hook (formerly Supabase Realtime)
 *
 * TODO: Migrate to collab-server WebSocket at ws://localhost:3001
 * Real-time collaboration features are currently disabled during EKS migration
 *
 * This hook maintains the same interface but all operations are no-ops
 * Components using this hook will continue to work without real-time features
 */

import { useState, useCallback, useRef, useMemo } from 'react';

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

const COLORS = [
    '#F87171', '#FB923C', '#FBBF24', '#4ADE80', '#22D3EE',
    '#60A5FA', '#A78BFA', '#F472B6', '#94A3B8'
];

function getRandomColor(): string {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function useSupabaseCollaboration(
    options: UseSupabaseCollaborationOptions
): UseSupabaseCollaborationReturn {
    const {
        entityType,
        entityId,
        userId,
    } = options;

    // Stabilize userColor
    const stableColorRef = useRef<string | null>(null);
    if (!stableColorRef.current) {
        stableColorRef.current = options.userColor || getRandomColor();
    }
    if (options.userColor && options.userColor !== stableColorRef.current) {
        stableColorRef.current = options.userColor;
    }

    const [isConnected] = useState(false);
    const [presenceUsers] = useState<PresenceUser[]>([]);
    const contentChangeCallbackRef = useRef<((content: string, userId: string) => void) | null>(null);

    const roomName = useMemo(() => `collab:${entityType}:${entityId}`, [entityType, entityId]);

    // TODO: Implement WebSocket connection to collab-server
    // useEffect(() => {
    //     if (!enabled || !entityId || !userId) return;
    //
    //     const ws = new WebSocket(`ws://localhost:3001/collab/${roomName}`);
    //
    //     ws.onopen = () => {
    //         // Send initial presence
    //         ws.send(JSON.stringify({
    //             type: 'presence',
    //             data: {
    //                 id: userId,
    //                 name: userName,
    //                 color: userColor,
    //                 avatar: avatarUrl,
    //                 lastSeen: Date.now(),
    //             }
    //         }));
    //     };
    //
    //     ws.onmessage = (event) => {
    //         const message = JSON.parse(event.data);
    //         if (message.type === 'presence_sync') {
    //             setPresenceUsers(message.users);
    //         } else if (message.type === 'content_change') {
    //             if (contentChangeCallbackRef.current) {
    //                 contentChangeCallbackRef.current(message.content, message.userId);
    //             }
    //         }
    //     };
    //
    //     return () => ws.close();
    // }, [enabled, entityId, userId, roomName]);

    // No-op during migration
    const updateCursorPosition = useCallback((position: number, blockId?: string) => {
        // TODO: Send cursor update via WebSocket
        console.log('[Collaboration] updateCursorPosition (disabled):', { position, blockId });
    }, []);

    // No-op during migration
    const broadcastContentChange = useCallback((content: string) => {
        // TODO: Broadcast content change via WebSocket
        console.log('[Collaboration] broadcastContentChange (disabled):', { contentLength: content.length });
    }, []);

    // Register callback for remote content changes
    const onRemoteContentChange = useCallback((callback: (content: string, userId: string) => void) => {
        contentChangeCallbackRef.current = callback;
    }, []);

    return {
        isConnected,
        presenceUsers,
        updateCursorPosition,
        broadcastContentChange,
        onRemoteContentChange,
    };
}
