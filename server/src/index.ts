import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import sensible from '@fastify/sensible';
import { env } from './config/env.js';
import { authPlugin } from './plugins/auth.js';
import { corsOptions } from './plugins/cors.js';
import { authRoutes } from './routes/auth/index.js';
import { teamRoutes } from './routes/teams/index.js';
import { projectRoutes } from './routes/projects/index.js';
import { issueRoutes } from './routes/issues/index.js';
import { labelRoutes } from './routes/labels/index.js';
import { inviteRoutes } from './routes/invites/index.js';
import { notificationRoutes } from './routes/notifications/index.js';
import { userRoutes } from './routes/users/index.js';
import { lilyChatRoutes } from './routes/lily-chat/index.js';
import { mcpProxyRoutes } from './routes/mcp-proxy/index.js';
import { cycleRoutes } from './routes/cycles/index.js';
import { prdRoutes } from './routes/prd/index.js';
import { databaseRoutes } from './routes/databases/index.js';
import { conversationRoutes } from './routes/conversations/index.js';
import { blockCommentRoutes } from './routes/block-comments/index.js';
import { dependencyRoutes } from './routes/dependencies/index.js';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

// --- Register plugins ---
await app.register(cors, corsOptions);
await app.register(cookie, { secret: env.JWT_SECRET });
await app.register(sensible);

// --- Auth plugin (preHandler JWT verification) ---
await app.register(authPlugin);

// --- Health check ---
app.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
});

// --- Register routes ---
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(teamRoutes, { prefix: '/api/teams' });

// Team-scoped routes (require :teamId in URL)
await app.register(projectRoutes, { prefix: '/api/:teamId/projects' });
await app.register(issueRoutes, { prefix: '/api/:teamId/issues' });
await app.register(labelRoutes, { prefix: '/api/:teamId/labels' });
await app.register(cycleRoutes, { prefix: '/api/:teamId/cycles' });
await app.register(prdRoutes, { prefix: '/api/:teamId/prd' });

// Global routes
await app.register(inviteRoutes, { prefix: '/api/invites' });
await app.register(notificationRoutes, { prefix: '/api/notifications' });
await app.register(userRoutes, { prefix: '/api/users' });
await app.register(lilyChatRoutes, { prefix: '/api/lily-chat' });
await app.register(mcpProxyRoutes, { prefix: '/api/mcp-proxy' });
await app.register(databaseRoutes, { prefix: '/api/databases' });
await app.register(conversationRoutes, { prefix: '/api/conversations' });
await app.register(blockCommentRoutes, { prefix: '/api/block-comments' });
await app.register(dependencyRoutes, { prefix: '/api' });

// --- Graceful shutdown ---
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

for (const signal of signals) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      app.log.info('Server closed');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  });
}

// --- Start server ---
const start = async () => {
  try {
    const host = '0.0.0.0';
    const port = Number(process.env.PORT) || 3000;

    await app.listen({ host, port });
    app.log.info(`Server listening on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { app };
