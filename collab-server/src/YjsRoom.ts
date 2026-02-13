/**
 * Yjs Room — Node.js Port
 *
 * Manages real-time collaboration for a single document room.
 * Handles:
 * - Yjs CRDT document sync (binary updates via JSON-encoded number[])
 * - Yjs Awareness protocol relay (cursor positions, selections, user info)
 * - Legacy cursor message relay
 * - Client connection lifecycle (join, leave)
 * - Document persistence via Redis (debounced)
 *
 * Message protocol (must match CloudflareYjsProvider on the client):
 *   sync       (server->client)  : { type: 'sync', data: number[] }
 *   update     (bidirectional)   : { type: 'update', data: number[] }
 *   awareness  (bidirectional)   : { type: 'awareness', data: any, clientId: string }
 *   cursor     (bidirectional)   : { type: 'cursor', userId, userName, color, avatar, blockId, position, selection }
 *   leave      (server->client)  : { type: 'leave', userId, userName, clientId }
 */

import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { getRedis } from './redis.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClientInfo {
    clientId: string;
    userId?: string;
    userName?: string;
}

// ─── YjsRoom ─────────────────────────────────────────────────────────────────

export class YjsRoom {
    public readonly roomId: string;

    private doc: Y.Doc;
    private connections: Map<WebSocket, ClientInfo> = new Map();
    private persistTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly PERSIST_DEBOUNCE_MS = 2000;
    private loaded = false;
    private loadPromise: Promise<void>;

    constructor(roomId: string) {
        this.roomId = roomId;
        this.doc = new Y.Doc();

        // Listen for document updates and persist (debounced)
        this.doc.on('update', () => {
            this.schedulePersist();
        });

        // Load persisted document from Redis
        this.loadPromise = this.loadFromRedis();
    }

    // ─── Persistence ─────────────────────────────────────────────────────────

    private async loadFromRedis(): Promise<void> {
        try {
            const redis = getRedis();
            const stored = await redis.getBuffer(`yjs:${this.roomId}`);
            if (stored) {
                const update = new Uint8Array(stored);
                Y.applyUpdate(this.doc, update);
                console.log(`[YjsRoom:${this.roomId}] Loaded persisted document, size: ${stored.length}`);
            } else {
                console.log(`[YjsRoom:${this.roomId}] No persisted document found, starting fresh`);
            }
        } catch (e) {
            console.error(`[YjsRoom:${this.roomId}] Failed to load persisted document:`, e);
        } finally {
            this.loaded = true;
        }
    }

    private schedulePersist(): void {
        if (this.persistTimer) {
            clearTimeout(this.persistTimer);
        }
        this.persistTimer = setTimeout(() => {
            this.persistTimer = null;
            this.persistNow();
        }, this.PERSIST_DEBOUNCE_MS);
    }

    private async persistNow(): Promise<void> {
        try {
            const currentState = Y.encodeStateAsUpdate(this.doc);
            const redis = getRedis();
            await redis.set(`yjs:${this.roomId}`, Buffer.from(currentState));
            console.log(`[YjsRoom:${this.roomId}] Persisted document, size: ${currentState.length}`);
        } catch (e) {
            console.error(`[YjsRoom:${this.roomId}] Failed to persist document:`, e);
        }
    }

    // ─── Connection Handling ─────────────────────────────────────────────────

    async addClient(ws: WebSocket): Promise<void> {
        // Wait for the document to finish loading before serving clients
        await this.loadPromise;

        const clientId = crypto.randomUUID();
        this.connections.set(ws, { clientId });

        console.log(`[YjsRoom:${this.roomId}] Client connected: ${clientId}, total: ${this.connections.size}`);

        // Send current document state to the new client
        const currentState = Y.encodeStateAsUpdate(this.doc);
        this.sendTo(ws, {
            type: 'sync',
            data: Array.from(currentState),
        });

        // Wire up message handler
        ws.on('message', (raw: Buffer | string) => {
            this.handleMessage(ws, raw);
        });

        ws.on('close', () => {
            this.handleClose(ws);
        });

        ws.on('error', (err: Error) => {
            console.error(`[YjsRoom:${this.roomId}] WebSocket error:`, err.message);
            this.handleClose(ws);
        });
    }

    // ─── Message Handling ────────────────────────────────────────────────────

    private handleMessage(ws: WebSocket, raw: Buffer | string): void {
        try {
            const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8'));

            switch (msg.type) {
                case 'update': {
                    // Yjs document update
                    if (!msg.data) break;
                    const update = new Uint8Array(msg.data);
                    Y.applyUpdate(this.doc, update, ws);

                    // Relay to other clients
                    this.broadcast(ws, {
                        type: 'update',
                        data: msg.data,
                    });
                    break;
                }

                case 'awareness': {
                    // Yjs Awareness update (cursor, selection, user info)
                    if (!msg.data) break;

                    // Store userId for leave tracking
                    const info = this.connections.get(ws);
                    if (info && msg.clientId) {
                        info.userId = msg.userId;
                        info.userName = msg.userName;
                    }

                    this.broadcast(ws, {
                        type: 'awareness',
                        data: msg.data,
                        clientId: msg.clientId,
                    });
                    break;
                }

                case 'cursor': {
                    // Legacy cursor update (non-awareness based)
                    const cursorInfo = this.connections.get(ws);
                    if (cursorInfo) {
                        cursorInfo.userId = msg.userId;
                        cursorInfo.userName = msg.userName;
                    }

                    this.broadcast(ws, {
                        type: 'cursor',
                        userId: msg.userId,
                        userName: msg.userName,
                        color: msg.color,
                        avatar: msg.avatar,
                        blockId: msg.blockId,
                        position: msg.position,
                        selection: msg.selection,
                    });
                    break;
                }

                default:
                    console.warn(`[YjsRoom:${this.roomId}] Unknown message type: ${msg.type}`);
            }
        } catch (error) {
            console.error(`[YjsRoom:${this.roomId}] Error processing message:`, error);
        }
    }

    private handleClose(ws: WebSocket): void {
        const info = this.connections.get(ws);
        this.connections.delete(ws);

        console.log(
            `[YjsRoom:${this.roomId}] Client disconnected: ${info?.clientId} (${info?.userName}), remaining: ${this.connections.size}`
        );

        // Broadcast leave event to remaining clients
        if (info?.userId) {
            this.broadcastAll({
                type: 'leave',
                userId: info.userId,
                userName: info.userName,
                clientId: info.clientId,
            });
        }

        // Persist document when last client disconnects
        if (this.connections.size === 0) {
            this.schedulePersist();
        }
    }

    // ─── Broadcasting ────────────────────────────────────────────────────────

    /**
     * Broadcast a message to all clients EXCEPT the sender
     */
    private broadcast(sender: WebSocket, message: Record<string, unknown>): void {
        const data = JSON.stringify(message);
        for (const [conn] of this.connections) {
            if (conn !== sender && conn.readyState === WebSocket.OPEN) {
                try {
                    conn.send(data);
                } catch (e) {
                    console.error(`[YjsRoom:${this.roomId}] Failed to send to client:`, e);
                }
            }
        }
    }

    /**
     * Broadcast a message to ALL clients (including sender)
     */
    private broadcastAll(message: Record<string, unknown>): void {
        const data = JSON.stringify(message);
        for (const [conn] of this.connections) {
            if (conn.readyState === WebSocket.OPEN) {
                try {
                    conn.send(data);
                } catch (e) {
                    console.error(`[YjsRoom:${this.roomId}] Failed to send to client:`, e);
                }
            }
        }
    }

    private sendTo(ws: WebSocket, message: Record<string, unknown>): void {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            } catch (e) {
                console.error(`[YjsRoom:${this.roomId}] Failed to send to client:`, e);
            }
        }
    }

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    /** Returns true when no clients are connected */
    isEmpty(): boolean {
        return this.connections.size === 0;
    }

    /** Number of active connections */
    get connectionCount(): number {
        return this.connections.size;
    }

    /** Final persist and cleanup */
    async destroy(): Promise<void> {
        // Cancel any pending persist timer
        if (this.persistTimer) {
            clearTimeout(this.persistTimer);
            this.persistTimer = null;
        }

        // Do one final persist
        await this.persistNow();

        // Close all remaining connections
        for (const [conn] of this.connections) {
            try {
                conn.close(1001, 'Room destroyed');
            } catch {
                // ignore close errors
            }
        }
        this.connections.clear();

        // Destroy the Yjs doc
        this.doc.destroy();

        console.log(`[YjsRoom:${this.roomId}] Destroyed`);
    }
}
