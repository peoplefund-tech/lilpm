/**
 * Liveblocks Yjs Provider for PRD Real-time Collaboration
 * 
 * Connects Tiptap editor to Liveblocks for real-time document sync.
 * Uses Yjs CRDT for conflict-free collaborative editing.
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import * as Y from 'yjs';
import { createClient, Room } from '@liveblocks/client';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';

type SyncStatus = 'connecting' | 'connected' | 'disconnected' | 'synced';

interface UseLiveblocksCollaborationOptions {
    documentId: string;
    teamId: string;
    userId: string;
    userName: string;
    userColor?: string;
    avatarUrl?: string;
    enabled?: boolean;
}

interface UseLiveblocksCollaborationReturn {
    yjsDoc: Y.Doc | null;
    provider: LiveblocksYjsProvider | null;
    status: SyncStatus;
    isConnected: boolean;
    isSynced: boolean;
}

// Liveblocks client - uses public API key
const client = createClient({
    publicApiKey: import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY || '',
    throttle: 100,
});

export function useLiveblocksCollaboration(options: UseLiveblocksCollaborationOptions): UseLiveblocksCollaborationReturn {
    const {
        documentId,
        teamId,
        userId,
        userName,
        userColor,
        enabled = true,
    } = options;

    const [status, setStatus] = useState<SyncStatus>('disconnected');
    const docRef = useRef<Y.Doc | null>(null);
    const providerRef = useRef<LiveblocksYjsProvider | null>(null);
    const leaveRef = useRef<(() => void) | null>(null);

    // Create room name from team and document ID
    const roomId = useMemo(() => `${teamId}-prd-${documentId}`, [teamId, documentId]);

    useEffect(() => {
        if (!enabled || !documentId || !teamId || !userId) {
            return;
        }

        // Don't initialize if no API key
        if (!import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY) {
            console.warn('[Liveblocks] No API key found. Set VITE_LIVEBLOCKS_PUBLIC_KEY');
            return;
        }

        // Create Yjs document
        const doc = new Y.Doc();
        docRef.current = doc;

        setStatus('connecting');

        // Enter the Liveblocks room
        const { room, leave } = client.enterRoom(roomId, {
            initialPresence: {
                cursor: null,
            },
        });
        leaveRef.current = leave;

        // Create Liveblocks Yjs provider
        const provider = new LiveblocksYjsProvider(room, doc);
        providerRef.current = provider;

        // Set awareness (user info for cursors)
        provider.awareness.setLocalState({
            user: {
                id: userId,
                name: userName,
                color: userColor || getRandomColor(),
            },
        });

        // Listen for sync
        provider.on('sync', (synced: boolean) => {
            if (synced) {
                setStatus('synced');
                console.log('[Liveblocks] Document synced');
            }
        });

        // Listen for connection status via room
        const unsubscribe = room.subscribe('status', (connectionStatus) => {
            if (connectionStatus === 'connected') {
                setStatus('connected');
            } else if (connectionStatus === 'disconnected') {
                setStatus('disconnected');
            }
        });

        return () => {
            unsubscribe();
            provider.destroy();
            doc.destroy();
            leave();
            docRef.current = null;
            providerRef.current = null;
            leaveRef.current = null;
            setStatus('disconnected');
        };
    }, [enabled, documentId, teamId, userId, userName, userColor, roomId]);

    return {
        yjsDoc: docRef.current,
        provider: providerRef.current,
        status,
        isConnected: status === 'connected' || status === 'synced',
        isSynced: status === 'synced',
    };
}

function getRandomColor(): string {
    const colors = [
        '#F87171', '#FB923C', '#FBBF24', '#4ADE80', '#22D3EE',
        '#60A5FA', '#A78BFA', '#F472B6', '#94A3B8'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}
