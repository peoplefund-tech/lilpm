/**
 * Redis Client Singleton
 *
 * Provides a shared Redis connection for Yjs document persistence.
 * Connects to REDIS_URL from environment (defaults to localhost:6379).
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis: Redis | null = null;

export function getRedis(): Redis {
    if (!redis) {
        redis = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy(times: number) {
                const delay = Math.min(times * 200, 5000);
                console.log(`[Redis] Retry attempt ${times}, next in ${delay}ms`);
                return delay;
            },
            reconnectOnError(err: Error) {
                const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
                return targetErrors.some((e) => err.message.includes(e));
            },
            lazyConnect: false,
        });

        redis.on('connect', () => {
            console.log('[Redis] Connected to', REDIS_URL.replace(/\/\/.*@/, '//<redacted>@'));
        });

        redis.on('error', (err: Error) => {
            console.error('[Redis] Error:', err.message);
        });

        redis.on('close', () => {
            console.log('[Redis] Connection closed');
        });
    }

    return redis;
}

export async function closeRedis(): Promise<void> {
    if (redis) {
        await redis.quit();
        redis = null;
        console.log('[Redis] Disconnected');
    }
}
