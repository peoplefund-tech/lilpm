/**
 * LilPM Collaboration Server
 *
 * Standalone Node.js server replacing Cloudflare Workers + Durable Objects.
 * Provides real-time document collaboration using Yjs CRDT over WebSocket
 * with Redis-backed persistence.
 *
 * WebSocket endpoint: /collab/room/:roomId?token=<jwt>
 * Health check:       GET /
 */

import http from 'node:http';
import { URL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { YjsRoom } from './YjsRoom.js';
import { closeRedis } from './redis.js';

// ─── Configuration ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3001', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ROOM_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ─── Room Registry ───────────────────────────────────────────────────────────

const rooms = new Map<string, YjsRoom>();
const roomCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

function getOrCreateRoom(roomId: string): YjsRoom {
    let room = rooms.get(roomId);
    if (!room) {
        room = new YjsRoom(roomId);
        rooms.set(roomId, room);
        console.log(`[Server] Room created: ${roomId}, total rooms: ${rooms.size}`);
    }

    // Cancel any pending cleanup since a client is joining
    const timer = roomCleanupTimers.get(roomId);
    if (timer) {
        clearTimeout(timer);
        roomCleanupTimers.delete(roomId);
        console.log(`[Server] Cancelled cleanup timer for room: ${roomId}`);
    }

    return room;
}

function scheduleRoomCleanup(roomId: string): void {
    // Don't double-schedule
    if (roomCleanupTimers.has(roomId)) return;

    const timer = setTimeout(async () => {
        roomCleanupTimers.delete(roomId);

        const room = rooms.get(roomId);
        if (room && room.isEmpty()) {
            console.log(`[Server] Room idle timeout, destroying: ${roomId}`);
            await room.destroy();
            rooms.delete(roomId);
            console.log(`[Server] Room destroyed: ${roomId}, remaining rooms: ${rooms.size}`);
        }
    }, ROOM_IDLE_TIMEOUT_MS);

    roomCleanupTimers.set(roomId, timer);
    console.log(`[Server] Scheduled cleanup for room: ${roomId} in ${ROOM_IDLE_TIMEOUT_MS / 1000}s`);
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
    // CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
        let totalConnections = 0;
        for (const room of rooms.values()) {
            totalConnections += room.connectionCount;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            service: 'lilpm-collab-server',
            status: 'healthy',
            version: '1.0.0',
            rooms: rooms.size,
            connections: totalConnections,
        }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

// ─── WebSocket Server ────────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });

// Parse room ID from path: /collab/room/:roomId
function parseRoomId(pathname: string): string | null {
    const match = pathname.match(/^\/collab\/room\/([^/?]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

// Verify JWT token
function verifyToken(token: string): { valid: boolean; payload?: jwt.JwtPayload } {
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        return { valid: true, payload: payload as jwt.JwtPayload };
    } catch {
        return { valid: false };
    }
}

// Handle WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const roomId = parseRoomId(url.pathname);

    if (!roomId) {
        console.warn(`[Server] WebSocket upgrade rejected: invalid path ${url.pathname}`);
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
    }

    // JWT verification from query param
    const token = url.searchParams.get('token');
    if (token) {
        const { valid } = verifyToken(token);
        if (!valid) {
            console.warn(`[Server] WebSocket upgrade rejected: invalid token for room ${roomId}`);
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
    } else if (process.env.NODE_ENV === 'production') {
        // In production, require a token
        console.warn(`[Server] WebSocket upgrade rejected: no token for room ${roomId}`);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, roomId);
    });
});

// Handle new WebSocket connection
wss.on('connection', (ws: WebSocket, _req: http.IncomingMessage, roomId: string) => {
    const room = getOrCreateRoom(roomId);
    room.addClient(ws);

    // When the client disconnects, check if the room is empty
    ws.on('close', () => {
        if (room.isEmpty()) {
            scheduleRoomCleanup(roomId);
        }
    });
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
    console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);

    // Cancel all cleanup timers
    for (const timer of roomCleanupTimers.values()) {
        clearTimeout(timer);
    }
    roomCleanupTimers.clear();

    // Destroy all rooms (persists documents)
    const destroyPromises: Promise<void>[] = [];
    for (const [id, room] of rooms) {
        console.log(`[Server] Persisting and destroying room: ${id}`);
        destroyPromises.push(room.destroy());
    }
    await Promise.allSettled(destroyPromises);
    rooms.clear();

    // Close Redis
    await closeRedis();

    // Close WebSocket server
    wss.close();

    // Close HTTP server
    server.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
        console.error('[Server] Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Start ───────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
    console.log(`[Server] LilPM Collaboration Server listening on port ${PORT}`);
    console.log(`[Server] WebSocket endpoint: ws://localhost:${PORT}/collab/room/:roomId`);
    console.log(`[Server] Health check: http://localhost:${PORT}/`);
    console.log(`[Server] JWT verification: ${process.env.NODE_ENV === 'production' ? 'REQUIRED' : 'optional (dev mode)'}`);
});
