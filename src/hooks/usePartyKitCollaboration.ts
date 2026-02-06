/**
 * PartyKit Yjs Provider for PRD Real-time Collaboration
 * 
 * Connects Tiptap editor to PartyKit server using y-partykit.
 * Handles real-time document sync and user awareness (cursors).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';

type SyncStatus = 'connecting' | 'connected' | 'disconnected' | 'synced';

interface UsePartyKitCollaborationOptions {
    documentId: string;
    teamId: string;
    userId: string;
    userName: string;
    userColor?: string;
    avatarUrl?: string;
    enabled?: boolean;
}

interface UsePartyKitCollaborationReturn {
    yjsDoc: Y.Doc | null;
    provider: YPartyKitProvider | null;
    status: SyncStatus;
    isConnected: boolean;
    isSynced: boolean;
}

// PartyKit host - will be set after deployment
const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';

export function usePartyKitCollaboration(options: UsePartyKitCollaborationOptions): UsePartyKitCollaborationReturn {
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
    const providerRef = useRef<YPartyKitProvider | null>(null);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (!enabled || !documentId || !teamId || !userId || initializedRef.current) {
            return;
        }

        // Create room name: team:prd:documentId
        const roomName = `${teamId}:prd:${documentId}`;

        // Create Yjs document
        const doc = new Y.Doc();
        docRef.current = doc;

        // Create PartyKit provider
        const provider = new YPartyKitProvider(PARTYKIT_HOST, roomName, doc, {
            connect: true,
        });
        providerRef.current = provider;

        // Set user awareness (cursor position, name, color)
        provider.awareness.setLocalState({
            user: {
                id: userId,
                name: userName,
                color: userColor || getRandomColor(),
            },
        });

        // Listen for connection status
        provider.on('status', ({ status: wsStatus }: { status: string }) => {
            if (wsStatus === 'connected') {
                setStatus('connected');
            } else if (wsStatus === 'disconnected') {
                setStatus('disconnected');
            }
        });

        // Listen for sync status
        provider.on('sync', (synced: boolean) => {
            if (synced) {
                setStatus('synced');
                console.log('[PartyKit] Document synced');
            }
        });

        setStatus('connecting');
        initializedRef.current = true;

        return () => {
            provider.disconnect();
            provider.destroy();
            doc.destroy();
            docRef.current = null;
            providerRef.current = null;
            initializedRef.current = false;
            setStatus('disconnected');
        };
    }, [enabled, documentId, teamId, userId, userName, userColor]);

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
