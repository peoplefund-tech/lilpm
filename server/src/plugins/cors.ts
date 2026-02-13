/**
 * CORS Plugin Configuration
 */

import type { FastifyCorsOptions } from '@fastify/cors';
import { env } from '../config/env.js';

export const corsOptions: FastifyCorsOptions = {
  origin: [env.SITE_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-AI-Provider', 'X-Function-Version'],
  maxAge: 86400,
};
