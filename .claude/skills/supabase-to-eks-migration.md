# Supabase to EKS Migration Skill

## Overview
Complete migration guide for converting a Supabase-based application to AWS EKS with custom API server, collaboration server, and PostgreSQL.

## Architecture

### Before (Supabase Stack)
- Frontend: Vercel
- Backend: Supabase Edge Functions (9 functions)
- Database: Supabase PostgreSQL + RLS (98 policies)
- Realtime: Supabase Channels
- Collaboration: Cloudflare Workers + Durable Objects
- Storage: Supabase Storage

### After (EKS Stack)
- Frontend: Nginx container (port 80)
- API Server: Fastify container (port 3000)
- Collab Server: Y.js WebSocket container (port 3001)
- Database: AWS RDS PostgreSQL (same schema, no RLS)
- Auth: Custom JWT (access 15min + refresh 7 days)
- ORM: Drizzle (TypeScript-first)
- Cache: ElastiCache Redis

## Migration Steps

### Phase 1: Infrastructure Setup

#### 1.1 Create Docker Compose for Local Development
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
      POSTGRES_DB: lilpm
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

#### 1.2 Setup API Server Structure
```
server/
  src/
    index.ts              # Fastify entry
    config/env.ts         # Zod-validated env schema
    db/
      index.ts            # pg Pool + drizzle()
      schema.ts           # Drizzle schema (30+ tables)
    plugins/
      auth.ts             # JWT verify preHandler
      cors.ts             # CORS config
      team-access.ts      # Team membership middleware
    services/
      email.ts            # nodemailer + Resend
    routes/
      auth/index.ts
      teams/index.ts
      projects/index.ts
      issues/index.ts
      # ... etc
```

#### 1.3 Setup Collab Server
```
collab-server/
  src/
    index.ts              # HTTP+WS server, JWT auth
    YjsRoom.ts            # Y.js CRDT room with Redis
    redis.ts              # ioredis singleton
```

### Phase 2: Database Migration

#### 2.1 Generate Drizzle Schema from Existing DB
```bash
cd server
npm install drizzle-orm drizzle-kit pg
npm run db:introspect  # Generate schema from existing Supabase DB
```

#### 2.2 Review and Clean Schema
- Remove RLS policies (application-level auth instead)
- Add proper TypeScript types
- Define enums with pgEnum
- Set up foreign keys and indexes

#### 2.3 Create Migrations
```bash
npm run db:generate  # Generate migration SQL
npm run db:migrate   # Apply to local PostgreSQL
```

### Phase 3: API Server Development

#### 3.1 Auth Route Pattern
```typescript
// server/src/routes/auth/index.ts
import { FastifyPluginAsync } from 'fastify';
import { db } from '../../db/index.js';
import { users, refreshTokens } from '../../db/schema.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /auth/register
  app.post('/register', async (request, reply) => {
    const { email, password } = request.body as any;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const [user] = await db.insert(users)
      .values({ email, password_hash: passwordHash })
      .returning();

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Store refresh token
    await db.insert(refreshTokens).values({
      user_id: user.id,
      token_hash: createHash('sha256').update(refreshToken).digest('hex'),
    });

    return { accessToken, refreshToken, user };
  });

  // POST /auth/login
  app.post('/login', async (request, reply) => {
    // Similar pattern
  });

  // POST /auth/refresh
  app.post('/refresh', async (request, reply) => {
    // Verify refresh token and issue new access token
  });
};
```

#### 3.2 Protected Route Pattern
```typescript
// server/src/routes/teams/index.ts
export const teamRoutes: FastifyPluginAsync = async (app) => {
  // GET /teams - requires auth
  app.get('/', {
    preHandler: app.requireAuth,
  }, async (request, reply) => {
    const userId = request.user!.userId;

    const teams = await db
      .select()
      .from(teams)
      .innerJoin(teamMembers, eq(teamMembers.team_id, teams.id))
      .where(eq(teamMembers.user_id, userId));

    return teams;
  });

  // POST /teams - requires auth
  app.post('/', {
    preHandler: app.requireAuth,
  }, async (request, reply) => {
    const { name, slug } = request.body as any;
    const userId = request.user!.userId;

    const [team] = await db.insert(teams)
      .values({ name, slug, created_by: userId })
      .returning();

    // Add creator as admin
    await db.insert(teamMembers).values({
      team_id: team.id,
      user_id: userId,
      role: 'admin',
    });

    return team;
  });
};
```

#### 3.3 Team Access Middleware Pattern
```typescript
// server/src/plugins/team-access.ts
export const requireTeamAccess = (minRole: 'viewer' | 'member' | 'admin' = 'member') => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.userId;
    const teamId = request.params.teamId;

    const [membership] = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.team_id, teamId),
        eq(teamMembers.user_id, userId)
      ));

    if (!membership) {
      throw app.httpErrors.forbidden('Not a team member');
    }

    // Check role hierarchy
    const roleLevel = { viewer: 1, member: 2, admin: 3 };
    if (roleLevel[membership.role] < roleLevel[minRole]) {
      throw app.httpErrors.forbidden('Insufficient permissions');
    }

    request.teamMembership = membership;
  };
};
```

### Phase 4: Frontend Migration

#### 4.1 API Client Setup
```typescript
// src/lib/api/client.ts
class APIClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(private baseURL: string) {
    this.loadTokens();
  }

  private loadTokens() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  private saveTokens(accessToken: string, refreshToken?: string) {
    this.accessToken = accessToken;
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      this.refreshToken = refreshToken;
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  async request<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<{ data?: T; error?: string }> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      let response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });

      // Handle token refresh on 401
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          response = await fetch(url, { method, headers, body: data ? JSON.stringify(data) : undefined });
        }
      }

      if (!response.ok) {
        const error = await response.json();
        return { error: error.message || 'Request failed' };
      }

      const result = await response.json();
      return { data: result };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const { accessToken } = await response.json();
        this.saveTokens(accessToken);
        return true;
      }
    } catch (err) {
      console.error('Token refresh failed', err);
    }

    this.logout();
    return false;
  }

  get<T>(endpoint: string) {
    return this.request<T>('GET', endpoint);
  }

  post<T>(endpoint: string, data: any) {
    return this.request<T>('POST', endpoint, data);
  }

  put<T>(endpoint: string, data: any) {
    return this.request<T>('PUT', endpoint, data);
  }

  delete<T>(endpoint: string) {
    return this.request<T>('DELETE', endpoint);
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  getAccessToken() {
    return this.accessToken;
  }
}

export const apiClient = new APIClient(import.meta.env.VITE_API_BASE_URL || '/api');
```

#### 4.2 Service Migration Pattern
```typescript
// BEFORE: src/features/issues/services/issue/issueService.ts
import { supabase } from '@/lib/supabase';

export const issueService = {
  async getIssues(teamId: string) {
    const { data, error } = await supabase
      .from('issues')
      .select('*, creator:users(*), assignee:users(*)')
      .eq('team_id', teamId);

    if (error) throw error;
    return data;
  },

  async createIssue(issue: CreateIssueInput) {
    const { data, error } = await supabase
      .from('issues')
      .insert(issue)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// AFTER: migrated version
import { apiClient } from '@/lib/api/client';

export const issueService = {
  async getIssues(teamId: string) {
    const res = await apiClient.get<Issue[]>(`/teams/${teamId}/issues`);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  async createIssue(teamId: string, issue: CreateIssueInput) {
    const res = await apiClient.post<Issue>(`/teams/${teamId}/issues`, issue);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },
};
```

#### 4.3 Conversion Patterns

| Supabase Call | API Client Equivalent |
|--------------|----------------------|
| `supabase.from('table').select()` | `apiClient.get('/endpoint')` |
| `supabase.from('table').insert(data)` | `apiClient.post('/endpoint', data)` |
| `supabase.from('table').update(data)` | `apiClient.put('/endpoint/:id', data)` |
| `supabase.from('table').delete()` | `apiClient.delete('/endpoint/:id')` |
| `supabase.auth.getUser()` | Remove (server handles via JWT) |
| `supabase.auth.signOut()` | `apiClient.post('/auth/logout')` |
| `supabase.rpc('fn', params)` | `apiClient.post('/rpc/fn', params)` |
| `supabase.channel(...)` | WebSocket or polling |

#### 4.4 Auth Store Migration
```typescript
// BEFORE: src/stores/authStore.ts
export const authStore = {
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // ...
  },
};

// AFTER
export const authStore = {
  async login(email: string, password: string) {
    const res = await apiClient.post<LoginResponse>('/auth/login', { email, password });
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  async logout() {
    await apiClient.post('/auth/logout', {});
    apiClient.logout();
  },
};
```

### Phase 5: Realtime Migration

#### 5.1 Supabase Channel → WebSocket
```typescript
// BEFORE
const channel = supabase.channel('room:123')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, (payload) => {
    console.log('Issue changed', payload);
  })
  .subscribe();

// AFTER: Use collab-server WebSocket
const ws = new WebSocket(`ws://localhost:3001/collab/room/${roomId}`);
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  // Handle Y.js sync messages
});
```

### Phase 6: Local Development

#### 6.1 Start Infrastructure
```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Or use local services
brew install postgresql redis
brew services start postgresql
brew services start redis
```

#### 6.2 Database Setup
```bash
cd server

# Install dependencies
npm install

# Generate and run migrations
npm run db:generate
npm run db:migrate
```

#### 6.3 Start All Services
```bash
# Terminal 1: API Server
cd server
npm run dev  # Runs on http://localhost:3000

# Terminal 2: Collab Server
cd collab-server
npm run dev  # Runs on ws://localhost:3001

# Terminal 3: Frontend
npm run dev  # Runs on http://localhost:8080
```

#### 6.4 Verify Services
```bash
# API server health
curl http://localhost:3000/health

# Collab server health
curl http://localhost:3001/

# Frontend
curl http://localhost:8080/
```

#### 6.5 Database Tools
```bash
# Drizzle Studio (Web GUI)
cd server
npm run db:studio
# Open https://local.drizzle.studio

# psql CLI
psql -U postgres -d lilpm -c "\dt"
psql -U postgres -d lilpm -c "\d users"
psql -U postgres -d lilpm -c "SELECT * FROM users;"
```

### Phase 7: Deployment to EKS

#### 7.1 Build Docker Images
```bash
# Frontend
docker build -f deploy/Dockerfile.frontend -t lilpm-frontend .

# API Server
docker build -f deploy/Dockerfile.api-server -t lilpm-api-server ./server

# Collab Server
docker build -f deploy/Dockerfile.collab-server -t lilpm-collab-server ./collab-server
```

#### 7.2 Deploy to EKS
```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/secret.yaml
kubectl apply -f deploy/k8s/frontend-deployment.yaml
kubectl apply -f deploy/k8s/api-server-deployment.yaml
kubectl apply -f deploy/k8s/collab-server-deployment.yaml
kubectl apply -f deploy/k8s/ingress.yaml
kubectl apply -f deploy/k8s/hpa.yaml
```

## Common Issues & Solutions

### Issue: "type already exists" during migration
**Solution:** Database already has schema. Skip migration or drop/recreate database.
```bash
psql -U postgres -d postgres -c "DROP DATABASE lilpm;"
psql -U postgres -d postgres -c "CREATE DATABASE lilpm;"
npm run db:migrate
```

### Issue: 401 Unauthorized on API calls
**Solution:** Check JWT token format and expiration.
```typescript
// Debug token
const token = apiClient.getAccessToken();
const decoded = jwt.decode(token);
console.log('Token payload:', decoded);
```

### Issue: CORS errors
**Solution:** Ensure CORS is properly configured in API server.
```typescript
// server/src/plugins/cors.ts
export const corsOptions = {
  origin: [
    'http://localhost:8080',
    'http://localhost:5173',
    process.env.SITE_URL,
  ],
  credentials: true,
};
```

### Issue: WebSocket connection refused
**Solution:** Verify collab-server is running and port is correct.
```bash
netstat -an | grep 3001
curl http://localhost:3001/
```

## Migration Checklist

### Server Side
- [ ] Drizzle schema generated from existing DB
- [ ] Auth routes (register, login, refresh, logout, verify-email)
- [ ] Team routes (CRUD, members)
- [ ] Project routes (CRUD, members)
- [ ] Issue routes (CRUD, comments, labels, dependencies)
- [ ] Notification routes
- [ ] User routes (profile, settings)
- [ ] AI/Lily chat routes (SSE streaming)
- [ ] MCP proxy routes
- [ ] Cycle routes
- [ ] PRD routes
- [ ] Database routes
- [ ] Conversation routes
- [ ] Block comment routes

### Frontend Side
- [ ] API client with token refresh
- [ ] Auth store migration
- [ ] Issue service migration
- [ ] Team service migration
- [ ] Project service migration
- [ ] Notification service migration
- [ ] User service migration
- [ ] Settings pages migration
- [ ] Realtime/collaboration migration
- [ ] Remove Supabase dependencies

### Verification
- [ ] Local development runs all 3 services
- [ ] Can register new user
- [ ] Can login and get JWT tokens
- [ ] Can create team
- [ ] Can create project
- [ ] Can create issue
- [ ] Can add comments
- [ ] Notifications work
- [ ] AI chat streaming works
- [ ] WebSocket collaboration works

## Performance Considerations

1. **Connection Pooling**: Use pg Pool with max 20 connections
2. **Redis Caching**: Cache user sessions and frequently accessed data
3. **Indexing**: Ensure foreign keys and frequently queried fields are indexed
4. **N+1 Queries**: Use Drizzle joins to avoid multiple queries
5. **JWT Expiration**: Short access token (15min) + long refresh token (7d)

## Security Best Practices

1. **Password Hashing**: bcrypt with rounds=10
2. **JWT Secrets**: 32+ character random strings
3. **SQL Injection**: Use Drizzle parameterized queries
4. **XSS**: Sanitize user input on frontend
5. **CSRF**: Use SameSite cookies or CSRF tokens
6. **Rate Limiting**: Implement on login/register endpoints
7. **HTTPS Only**: In production, enforce HTTPS
8. **Environment Variables**: Never commit .env files

## Rollback Strategy

If migration fails, keep Supabase running in parallel:
1. Use feature flags to toggle between old/new backend
2. Run both systems with same database (read-only Supabase)
3. Gradually migrate users
4. Monitor errors and performance
5. Full cutover when confident

## Next Steps After Migration

1. **Remove Supabase Dependencies**
   ```bash
   npm uninstall @supabase/supabase-js
   rm src/lib/supabase.ts
   rm -rf supabase/
   ```

2. **Update Environment Variables**
   - Remove `VITE_SUPABASE_URL`
   - Remove `VITE_SUPABASE_ANON_KEY`
   - Keep only `VITE_API_BASE_URL`

3. **Setup CI/CD**
   - Build Docker images
   - Push to ECR
   - Deploy to EKS
   - Run integration tests

4. **Monitoring**
   - Setup CloudWatch logs
   - Setup application metrics
   - Setup alerts for errors

## Reference

- Drizzle ORM: https://orm.drizzle.team
- Fastify: https://fastify.dev
- Y.js: https://docs.yjs.dev
- PostgreSQL: https://postgresql.org/docs
