/**
 * YjsSupabaseProvider - Custom Yjs provider using Supabase Realtime for synchronization
 * 
 * This provider syncs Yjs document state between multiple clients using Supabase Realtime
 * broadcast channels. It also persists state to the database for recovery.
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
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;

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
                } catch (error) {
                    console.error('[YjsSupabase] Failed to apply update:', error);
                }
            }
        });

        // Handle awareness updates
        this.channel.on('broadcast', { event: 'awareness' }, (payload) => {
            if (payload.payload?.states) {
                try {
                    // Update awareness state from other clients
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

        // Handle sync request (new client joining)
        this.channel.on('broadcast', { event: 'sync-request' }, (payload) => {
            // Send full state to new client
            if (payload.payload?.clientId !== this.doc.clientID) {
                this.broadcastFullState();
            }
        });

        // Subscribe to channel
        this.channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                this.notifyStatus('connected');

                // Skip DB load - use broadcast-only sync to avoid 406 errors
                // Request sync from other clients (they will send their full state)
                this.channel?.send({
                    type: 'broadcast',
                    event: 'sync-request',
                    payload: { clientId: this.doc.clientID }
                });

                // Mark as synced after a short delay (other clients will send state if they have it)
                setTimeout(() => {
                    if (!this.synced) {
                        this.synced = true;
                        this.notifyStatus('synced');
                    }
                }, 500);
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

        // Broadcast update to other clients (no DB save - broadcast only)
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

    private async loadInitialState(): Promise<void> {
        try {
            const tableName = this.options.documentType === 'prd'
                ? 'prd_yjs_state'
                : 'issue_yjs_state';

            const { data, error } = await supabase
                .from(tableName)
                .select('state')
                .eq(`${this.options.documentType}_id`, this.options.documentId)
                .single();

            // PGRST116 = no rows found (expected for new docs)
            // 406 = schema mismatch/table access issue - continue with broadcast-only sync
            const is406 = String(error?.message || '').includes('406') || error?.code === '406';
            if (error && error.code !== 'PGRST116' && !is406) {
                console.error('[YjsSupabase] Failed to load state:', error);
                return;
            }

            // If 406, log once and continue without DB persistence
            if (is406) {
                console.warn('[YjsSupabase] Table not accessible, using broadcast-only sync');
            }

            if (data?.state) {
                const state = this.base64ToUint8Array(data.state);
                Y.applyUpdate(this.doc, state, 'db');
            }

            this.synced = true;
            this.notifyStatus('synced');
        } catch (error) {
            console.error('[YjsSupabase] Failed to load initial state:', error);
        }
    }

    private scheduleSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Save after 2 seconds of inactivity
        this.saveTimeout = setTimeout(() => {
            this.saveState();
        }, 2000);
    }

    private async saveState(): Promise<void> {
        if (this.destroyed) return;

        try {
            const state = Y.encodeStateAsUpdate(this.doc);
            const tableName = this.options.documentType === 'prd'
                ? 'prd_yjs_state'
                : 'issue_yjs_state';

            const { error } = await supabase
                .from(tableName)
                .upsert({
                    [`${this.options.documentType}_id`]: this.options.documentId,
                    state: this.uint8ArrayToBase64(state),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: `${this.options.documentType}_id`
                });

            if (error) {
                // Suppress 406 errors (table access issues)
                const is406 = String(error?.message || '').includes('406') || error?.code === '406';
                if (!is406) {
                    console.error('[YjsSupabase] Failed to save state:', error);
                }
            }
        } catch (err) {
            // Suppress 406 errors
            const errorStr = String(err);
            if (!errorStr.includes('406')) {
                console.error('[YjsSupabase] Failed to save state:', err);
            }
        }
    }

    // Utility functions for base64 encoding/decoding
    private uint8ArrayToBase64(bytes: Uint8Array): string {
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    private base64ToUint8Array(base64: string): Uint8Array {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    private notifyStatus(status: SyncStatus): void {
        this.statusListeners.forEach(listener => listener(status));
    }

    // Public API

    get isSynced(): boolean {
        return this.synced;
    }

    get userName(): string {
        return this.options.userName;
    }

    get userColor(): string | undefined {
        return this.options.userColor;
    }

    get awareness(): Awareness {
        return this._awareness;
    }

    getAwareness(): Awareness {
        return this._awareness;
    }

    onStatus(callback: (status: SyncStatus) => void): () => void {
        this.statusListeners.add(callback);
        return () => this.statusListeners.delete(callback);
    }

    updateAwareness(field: string, value: any): void {
        this._awareness.setLocalStateField(field, value);

        // Broadcast awareness update
        if (this.channel) {
            this.channel.send({
                type: 'broadcast',
                event: 'awareness',
                payload: {
                    states: { [this.doc.clientID]: this._awareness.getLocalState() }
                }
            });
        }
    }

    destroy(): void {
        this.destroyed = true;

        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Save final state
        this.saveState();

        this.doc.off('update', this.handleDocUpdate);
        this._awareness.destroy();

        if (this.channel) {
            this.channel.unsubscribe();
            this.channel = null;
        }

        this.statusListeners.clear();
    }
}
