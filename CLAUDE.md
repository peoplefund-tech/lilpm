# LilPM EKS Migration — Context & Progress

## Project Overview
LilPM is a Linear-like PM tool being migrated from free-tier services (Vercel, Supabase, Cloudflare Workers/PartyKit) to **AWS EKS** cluster.

- **Git remote**: `https://github.com/peoplefund-tech/lilpm.git`
- **Branch**: `brave-pascal`
- **Tech choices**: EKS (4 containers), Drizzle ORM, custom JWT auth, full migration at once

## Architecture

### EKS Containers
1. **frontend** (nginx:80) — SPA served from nginx
2. **api-server** (Fastify:3000) — REST API replacing 9 Supabase Edge Functions + CRUD
3. **collab-server** (ws:3001) — y-websocket replacing Cloudflare Workers + Durable Objects
4. **PostgreSQL** (RDS) — existing DB, no schema change

### ALB Ingress
- `/api/*` → api-server
- `/collab/*` → collab-server
- `/*` → frontend

### Key Decisions
- **Drizzle ORM** for TypeScript-first DB access (user chose over Prisma)
- **Custom JWT auth** — access token (15min HS256) + refresh token (7 days, SHA256 stored in DB)
- **Application-level auth** — replaces 98 PostgreSQL RLS policies with Fastify preHandler middleware
- **ElastiCache Redis** — Yjs document persistence + session store
- **nodemailer** — Gmail SMTP + Resend API fallback

## File Structure (New)

```
server/
  src/
    index.ts              # Fastify entry, graceful shutdown
    config/env.ts         # Zod-validated env schema
    db/index.ts           # pg Pool + drizzle()
    db/schema.ts          # 30+ tables, 10 pgEnums (complete)
    plugins/
      auth.ts             # JWT verify preHandler, requireAuth()
      cors.ts             # CORS config
      team-access.ts      # Team membership + role hierarchy
    services/
      email.ts            # nodemailer + Resend fallback
    routes/
      auth/index.ts       # 11 auth endpoints (446 lines)
      teams/index.ts      # Team CRUD (256 lines)
      projects/index.ts   # Project CRUD (233 lines)
      issues/index.ts     # Issue CRUD (414 lines)
      labels/index.ts     # Label CRUD (161 lines)
      invites/index.ts    # Invite management (457 lines)
      notifications/index.ts  # Notifications (374 lines)
      users/index.ts      # User profiles (288 lines)
      lily-chat/index.ts  # AI chat SSE streaming (1134 lines)
      mcp-proxy/index.ts  # MCP proxy (197 lines)
      cycles/index.ts     # [PENDING - agent creating]
      prd/index.ts        # [PENDING - agent creating]
      databases/index.ts  # [PENDING - agent creating]
      conversations/index.ts  # [PENDING - agent creating]
      mentions/index.ts   # [PENDING - agent creating]

collab-server/
  src/
    index.ts              # HTTP+WS server, JWT auth, room registry
    YjsRoom.ts            # Ported from Durable Objects, Redis persistence
    redis.ts              # ioredis singleton

deploy/
  nginx.conf              # SPA with gzip, security headers
  Dockerfile.frontend     # Multi-stage build
  k8s/
    namespace.yaml, configmap.yaml, secret.yaml
    frontend-deployment.yaml, api-server-deployment.yaml
    collab-server-deployment.yaml, ingress.yaml, hpa.yaml
```

## Migration Patterns

### supabase → apiClient Conversion
```
supabase.from('table').select(...)     → apiClient.get('/endpoint')
supabase.from('table').insert(...)     → apiClient.post('/endpoint', data)
supabase.from('table').update(...)     → apiClient.put('/endpoint', data)
supabase.from('table').delete(...)     → apiClient.delete('/endpoint')
supabase.auth.getUser()                → Remove (server handles via JWT)
supabase.auth.getSession()             → apiClient.getAccessToken()
supabase.auth.updateUser(...)          → apiClient.put('/auth/me', data)
supabase.auth.signOut()                → apiClient.post('/auth/logout')
supabase.rpc('fn', params)             → apiClient.post('/rpc/fn', params)
supabase.storage.from().upload()       → apiClient.post('/upload', FormData)
supabase.channel(...)                  → WebSocket or polling
Edge Function fetch(SUPABASE_URL/...)  → apiClient.post('/endpoint')
```

### apiClient Response Pattern
```typescript
const res = await apiClient.get<T>('/endpoint');
if (res.error) throw new Error(res.error);
return res.data;
```

## Progress Status

### ✅ COMPLETED
- [x] Infrastructure scaffolding (deploy/, Dockerfile, k8s)
- [x] Collab server (y-websocket + Redis)
- [x] API server foundation (Fastify, schema, plugins, services)
- [x] **15 API routes** (auth, teams, projects, issues, labels, invites, notifications, users, lily-chat, mcp-proxy, cycles, prd, databases, conversations, block-comments)
- [x] Frontend Auth migration (client.ts token refresh, authStore.ts rewrite, 4 auth pages)
- [x] issueService.ts migrated to apiClient
- [x] **Local development environment** (PostgreSQL, Redis, all 3 servers running)
- [x] Migration skill documentation

### 🔄 IN PROGRESS
- [ ] Issue sub-services: labelService, commentService, issueActivityService, dependencyService, issueTemplateService
- [ ] lib/services: teamService, teamMemberService, profileService, teamInviteService, notificationService, cycleService, activityService, blockCommentService, conversationService
- [ ] Feature services: projectService, projectMemberService, prdService, prdVersionService, lily/store, chatStream, mcpUtils

### TODO
- [ ] **Settings pages**: SecuritySettingsPage.tsx, ProfilePage.tsx, AISettingsPage.tsx
- [ ] **Feature pages**: useDatabaseHandlers.ts (10 supabase.from calls), SharedConversationPage, InboxPage, TeamMembersPage (supabase.rpc), IssueDetailPage (supabase.rpc), ArchivePage (supabase.rpc + from), ShareConversationModal, PRDDetailPage
- [ ] **Stores/hooks**: issues/store.ts, lily/store.ts, useTeamMembers, useNotifications, useAISettings
- [ ] **Realtime migration** (supabase.channel → WebSocket/polling): collaborationStore, useSidebarPresence, useTeamRealtime, useSupabaseCollaboration
- [ ] **Server index.ts route registration**: Register all route plugins
- [ ] **Supabase dependency removal**: Delete @supabase/supabase-js, src/lib/supabase.ts, supabase/, workers/, party/ dirs
- [ ] **Environment variable cleanup**: Remove VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

## Files Using Supabase (41 total, decreasing as migrated)

### Priority 1: Services (agents handling)
src/lib/services/team/teamService.ts, teamMemberService.ts, profileService.ts, teamInviteService.ts
src/lib/services/notificationService.ts, cycleService.ts, activityService.ts, blockCommentService.ts, conversationService.ts
src/features/issues/services/issue/labelService.ts, commentService.ts, issueActivityService.ts, dependencyService.ts
src/features/issues/services/issueTemplateService.ts
src/features/projects/services/projectService.ts, projectMemberService.ts
src/features/prd/services/prdService.ts, prdVersionService.ts
src/features/lily/utils/chatStream.ts, mcpUtils.ts
src/features/lily/store.ts

### Priority 2: Pages & Components
src/pages/settings/SecuritySettingsPage.tsx — supabase.auth.updateUser, signOut
src/pages/settings/ProfilePage.tsx — supabase.storage, auth.updateUser
src/pages/settings/AISettingsPage.tsx
src/pages/hooks/useDatabaseHandlers.ts — 10x supabase.from() (heaviest)
src/pages/SharedConversationPage.tsx
src/pages/InboxPage.tsx
src/features/team/pages/TeamMembersPage.tsx — supabase.rpc
src/features/issues/pages/IssueDetailPage.tsx — supabase.rpc('archive_item')
src/features/issues/pages/MyIssuesPage.tsx
src/features/issues/pages/ArchivePage.tsx — supabase.rpc + from
src/features/lily/components/panels/ShareConversationModal.tsx
src/features/prd/pages/PRDDetailPage.tsx
src/features/prd/pages/PRDDetail/hooks/usePRDAIAssistant.ts
src/features/issues/pages/IssueDetail/hooks/useIssueAIAssistant.ts

### Priority 3: Realtime (supabase.channel)
src/stores/collaborationStore.ts
src/hooks/useSidebarPresence.ts
src/hooks/data/useTeamRealtime.ts
src/hooks/collaboration/useSupabaseCollaboration.ts

### Priority 4: Data hooks
src/hooks/data/useTeamMembers.ts
src/hooks/data/useNotifications.ts
src/hooks/data/useAISettings.ts
src/features/issues/store.ts

## Local Development

### Quick Start
```bash
# 1. Start infrastructure (PostgreSQL + Redis)
brew services start postgresql
brew services start redis

# 2. Setup database (first time only)
cd server
npm install
npm run db:generate  # Generate migrations
npm run db:migrate   # Apply migrations

# 3. Start all services (3 terminals)
# Terminal 1: API Server
cd server && npm run dev  # http://localhost:3000

# Terminal 2: Collab Server
cd collab-server && npm run dev  # ws://localhost:3001

# Terminal 3: Frontend
npm run dev  # http://localhost:8080
```

### Verify Services
```bash
# API server health
curl http://localhost:3000/health

# Collab server health
curl http://localhost:3001/

# Frontend
open http://localhost:8080
```

### Database Tools
```bash
# Drizzle Studio (Web GUI) - Recommended
cd server && npm run db:studio
# Open https://local.drizzle.studio

# psql CLI
psql -U janghyuk -d lilpm
\dt              # List tables
\d users         # Show table structure
SELECT * FROM users;
```

### Current Database Status
- **35 tables** created
- **1 user** exists (janghyuk@pfct.co.kr)
- Local PostgreSQL: localhost:5432
- Local Redis: localhost:6379

## How to Resume
1. Check completed routes: `find server/src/routes -name "*.ts"`
2. Check remaining supabase imports: `grep -r "import.*supabase" src/ --include="*.ts*"`
3. Continue migrating remaining files using the patterns in `.claude/skills/supabase-to-eks-migration.md`
4. Handle Realtime migration (supabase.channel → collab-server WebSocket)
5. Remove Supabase dependencies after full migration
