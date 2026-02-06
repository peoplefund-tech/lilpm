/**
 * YjsSupabaseProvider - Custom Yjs provider using Supabase Realtime for synchronization
 * 
 * This provider syncs Yjs document state between multiple clients using Supabase Realtime
 * broadcast channels. Uses broadcast-only sync (no database persistence).
 */

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { supabase } from '@/lib/supabase';

export interface YjsSupabaseProviderOptions {
    documentId: string;
    documentType: 'prd' | 'issue';
    teamId: string;
    userId: string;
    userName: string;
    userColor?: string;
    avatarUrl?: string;
}

type SyncStatus = 'connecting' | 'connected' | 'disconnected' | 'synced';

export class YjsSupabaseProvider {
    private doc: Y.Doc;
    private _awareness: Awareness;
    private channel: ReturnType<typeof supabase.channel> | null = null;
    private options: YjsSupabaseProviderOptions;
    private synced = false;
    private destroyed = false;
    private statusListeners: Set<(status: SyncStatus) => void> = new Set();
    private respondedToClients: Set<number> = new Set(); // Track clients we've already responded to
    private lastBroadcastTime = 0;
    private readonly MIN_BROADCAST_INTERVAL = 1000; // Minimum 1 second between full state broadcasts

    // Public getters for Tiptap CollaborationCursor
    public get userName(): string {
        return this.options.userName;
    }

    public get userColor(): string {
        return this.options.userColor || this.getRandomColor();
    }

    constructor(doc: Y.Doc, options: YjsSupabaseProviderOptions) {
        this.doc = doc;
        this.options = options;
        this._awareness = new Awareness(doc);

        // Set local awareness state
        this._awareness.setLocalState({
            user: {
                id: options.userId,
                name: options.userName,
                color: options.userColor || this.getRandomColor(),
                avatar: options.avatarUrl,
            },
            cursor: null,
        });

        // Listen for local document changes
        this.doc.on('update', this.handleDocUpdate);

        // Connect to Supabase Realtime
        this.connect();
    }

    private getRandomColor(): string {
        const colors = [
            '#F87171', '#FB923C', '#FBBF24', '#4ADE80', '#22D3EE',
            '#60A5FA', '#A78BFA', '#F472B6', '#94A3B8'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private async connect(): Promise<void> {
        if (this.destroyed) return;

        this.notifyStatus('connecting');

        const channelName = `yjs:${this.options.documentType}:${this.options.documentId}`;
        this.channel = supabase.channel(channelName, {
            config: { broadcast: { self: false } }
        });

        // Handle document sync messages
        this.channel.on('broadcast', { event: 'sync' }, (payload) => {
            if (payload.payload?.update) {
                try {
                    const update = this.base64ToUint8Array(payload.payload.update);
                    Y.applyUpdate(this.doc, update, 'remote');

                    // Mark as synced on first update received
                    if (!this.synced) {
                        this.synced = true;
                        this.notifyStatus('synced');
                    }
                } catch (error) {
                    console.error('[YjsSupabase] Failed to apply update:', error);
                }
            }
        });

        // Handle awareness updates
        this.channel.on('broadcast', { event: 'awareness' }, (payload) => {
            if (payload.payload?.states) {
                try {
                    const states = payload.payload.states;
                    Object.entries(states).forEach(([clientId, state]) => {
                        if (parseInt(clientId) !== this.doc.clientID) {
                            this.awareness.setLocalStateField('remoteUsers', {
                                ...this.awareness.getLocalState()?.remoteUsers,
                                [clientId]: state
                            });
                        }
                    });
                } catch (error) {
                    console.error('[YjsSupabase] Failed to update awareness:', error);
                }
            }
        });

        // Handle sync request (new client joining) - with debounce and tracking
        this.channel.on('broadcast', { event: 'sync-request' }, (payload) => {
            const requestingClientId = payload.payload?.clientId;

            // Skip if it's our own request
            if (requestingClientId === this.doc.clientID) return;

            // Skip if we've already responded to this client recently
            if (this.respondedToClients.has(requestingClientId)) {
                console.log('[YjsSupabase] Already responded to client:', requestingClientId);
                return;
            }

            // Rate limit: don't broadcast too frequently
            const now = Date.now();
            if (now - this.lastBroadcastTime < this.MIN_BROADCAST_INTERVAL) {
                console.log('[YjsSupabase] Rate limiting full state broadcast');
                return;
            }

            // Only respond if we have content in our doc
            const docState = Y.encodeStateAsUpdate(this.doc);
            if (docState.length <= 2) { // Empty doc is ~2 bytes
                console.log('[YjsSupabase] Doc is empty, skipping full state broadcast');
                return;
            }

            // Mark this client as responded and broadcast
            this.respondedToClients.add(requestingClientId);
            this.lastBroadcastTime = now;

            // Clear the tracking after 30 seconds (allow re-sync if client reconnects)
            setTimeout(() => {
                this.respondedToClients.delete(requestingClientId);
            }, 30000);

            this.broadcastFullState();
        });

        // Subscribe to channel
        this.channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                this.notifyStatus('connected');

                // Request sync from other clients
                this.channel?.send({
                    type: 'broadcast',
                    event: 'sync-request',
                    payload: { clientId: this.doc.clientID }
                });

                // Mark as synced after a short delay if no response
                setTimeout(() => {
                    if (!this.synced) {
                        this.synced = true;
                        this.notifyStatus('synced');
                    }
                }, 1000);
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                this.notifyStatus('disconnected');
                // Attempt reconnect after delay
                if (!this.destroyed) {
                    setTimeout(() => this.connect(), 3000);
                }
            }
        });
    }

    private handleDocUpdate = (update: Uint8Array, origin: any): void => {
        if (origin === 'remote') return; // Don't broadcast remote updates

        // Broadcast update to other clients
        this.broadcastUpdate(update);
    };

    private broadcastUpdate(update: Uint8Array): void {
        if (!this.channel) return;

        this.channel.send({
            type: 'broadcast',
            event: 'sync',
            payload: {
                update: this.uint8ArrayToBase64(update),
                clientId: this.doc.clientID
            }
        });
    }

    private broadcastFullState(): void {
        if (!this.channel) return;

        const state = Y.encodeStateAsUpdate(this.doc);
        console.log('[YjsSupabase] Broadcasting full state:', state.length, 'bytes');

        this.channel.send({
            type: 'broadcast',
            event: 'sync',
            payload: {
                update: this.uint8ArrayToBase64(state),
                clientId: this.doc.clientID,
                isFullState: true
            }
        });
    }

    // Awareness getter
    get awareness(): Awareness {
        return this._awareness;
    }

    // Status listener management
    onStatus(callback: (status: SyncStatus) => void): () => void {
        this.statusListeners.add(callback);
        return () => this.statusListeners.delete(callback);
    }

    private notifyStatus(status: SyncStatus): void {
        this.statusListeners.forEach(callback => callback(status));
    }

    // Base64 utilities
    private uint8ArrayToBase64(bytes: Uint8Array): string {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    private base64ToUint8Array(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // Cleanup
    destroy(): void {
        this.destroyed = true;
        this.doc.off('update', this.handleDocUpdate);

        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
        }

        this._awareness.destroy();
        this.statusListeners.clear();
        this.respondedToClients.clear();
    }
}
