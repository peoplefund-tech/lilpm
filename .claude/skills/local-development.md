# Local Development - Start LilPM Servers

## Overview
Starts all LilPM services locally for development: PostgreSQL, Redis, API server, Collab server, and Frontend.

## Prerequisites

### Required Services
```bash
# Install if not already installed
brew install postgresql redis

# Start services
brew services start postgresql
brew services start redis

# Verify running
brew services list | grep -E "postgresql|redis"
```

### First-Time Setup

#### 1. Database Setup
```bash
# Install dependencies
cd server
npm install

# Generate Drizzle migrations
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Verify tables created
npm run db:studio
# Opens https://local.drizzle.studio - check that 35 tables exist
```

#### 2. Install All Dependencies
```bash
# From project root
npm install

# Collab server
cd collab-server
npm install
```

## Start All Services

### Method 1: Three Terminal Windows (Recommended)

**Terminal 1: API Server**
```bash
cd server
npm run dev
# Running at http://localhost:3000
# Logs: API requests, DB queries, auth events
```

**Terminal 2: Collab Server**
```bash
cd collab-server
npm run dev
# Running at ws://localhost:3001
# Logs: WebSocket connections, Yjs sync, Redis ops
```

**Terminal 3: Frontend**
```bash
npm run dev
# Running at http://localhost:8080
# Vite dev server with HMR
```

### Method 2: Background Processes (Quick Test)

```bash
# Start API server in background
cd server && npm run dev > /tmp/api.log 2>&1 &
echo "API PID: $!"

# Start Collab server in background
cd collab-server && npm run dev > /tmp/collab.log 2>&1 &
echo "Collab PID: $!"

# Start Frontend (keep in foreground for HMR)
npm run dev
```

## Verify Services

### Health Checks
```bash
# API server
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"...","uptime":...}

# Collab server
curl http://localhost:3001/
# Expected: {"service":"lilpm-collab-server","status":"healthy",...}

# Frontend
curl -I http://localhost:8080
# Expected: HTTP/1.1 200 OK
```

### Port Status
```bash
lsof -i :3000 # API server
lsof -i :3001 # Collab server
lsof -i :8080 # Frontend
lsof -i :5432 # PostgreSQL
lsof -i :6379 # Redis
```

## Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:8080 | Main application UI |
| API Server | http://localhost:3000 | REST API endpoints |
| Collab Server | ws://localhost:3001 | WebSocket for real-time collaboration |
| Drizzle Studio | https://local.drizzle.studio | Database GUI (run `npm run db:studio` in server/) |
| PostgreSQL | localhost:5432 | Direct DB access via psql |
| Redis CLI | localhost:6379 | Direct cache access via redis-cli |

## Test Login

### Existing Test Account
- **Email**: janghyuk@pfct.co.kr
- **Password**: (your password)

### Login Flow
1. Open http://localhost:8080
2. Navigate to login page
3. Enter credentials
4. Check browser DevTools:
   - Network: `POST /api/auth/login` should return 200
   - Response: Contains `accessToken` and `refreshToken`
   - No console errors

## Common Issues

### Port Already in Use
```bash
# Find process using port
lsof -ti :3000 # or :3001, :8080

# Kill process
kill -9 $(lsof -ti :3000)
```

### PostgreSQL Not Running
```bash
# Check status
brew services list | grep postgresql

# Restart
brew services restart postgresql

# Manual start
pg_ctl -D /opt/homebrew/var/postgresql@14 start
```

### Redis Not Running
```bash
# Check status
brew services list | grep redis

# Restart
brew services restart redis

# Manual start
redis-server
```

### Database Connection Error
```bash
# Verify database exists
psql -U janghyuk -d postgres -c "\l" | grep lilpm

# Create if missing
createdb -U janghyuk lilpm

# Re-run migrations
cd server && npm run db:migrate
```

### Module Not Found
```bash
# Clean install all dependencies
rm -rf node_modules package-lock.json
npm install

# Same for server/
cd server
rm -rf node_modules package-lock.json
npm install

# Same for collab-server/
cd collab-server
rm -rf node_modules package-lock.json
npm install
```

### Vite Build Errors
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Restart dev server
npm run dev
```

## Stop All Services

### Graceful Shutdown
```bash
# In each terminal: Ctrl+C

# Or kill by port
kill $(lsof -ti :3000) # API
kill $(lsof -ti :3001) # Collab
kill $(lsof -ti :8080) # Frontend
```

### Stop Infrastructure
```bash
brew services stop postgresql
brew services stop redis
```

## Development Workflow

### Hot Reloading
- **Frontend**: Vite HMR - instant updates
- **API Server**: nodemon - auto-restarts on file changes
- **Collab Server**: nodemon - auto-restarts on file changes

### Database Changes
```bash
# 1. Edit server/src/db/schema.ts
# 2. Generate migration
cd server && npm run db:generate

# 3. Apply migration
npm run db:migrate

# 4. Verify in Drizzle Studio
npm run db:studio
```

### View Logs
```bash
# If running in background
tail -f /tmp/api.log
tail -f /tmp/collab.log

# Real-time logs in terminals
# (Just watch the terminal windows where services are running)
```

## Quick Commands Reference

```bash
# Full startup from scratch
brew services start postgresql && brew services start redis
cd server && npm run dev &
cd collab-server && npm run dev &
npm run dev

# Health check all services
curl -s http://localhost:3000/health && \
curl -s http://localhost:3001/ && \
curl -s -I http://localhost:8080 | head -1

# Database inspection
cd server && npm run db:studio  # Web GUI
psql -U janghyuk -d lilpm       # CLI

# Redis inspection
redis-cli ping                  # Test connection
redis-cli monitor               # Watch all commands
redis-cli KEYS "*"             # List all keys

# Stop everything
killall node && brew services stop postgresql && brew services stop redis
```

## Environment Variables

### Frontend (.env)
```bash
VITE_API_BASE_URL=http://localhost:3000
VITE_COLLAB_WS_URL=ws://localhost:3001
```

### API Server (server/.env)
```bash
DATABASE_URL=postgresql://janghyuk@localhost:5432/lilpm
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key
PORT=3000
NODE_ENV=development
```

### Collab Server (collab-server/.env)
```bash
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-min-32-chars
PORT=3001
NODE_ENV=development
```

## Notes
- All services must be running for full functionality
- Frontend proxies `/api` to API server and `/collab` to Collab server (configured in vite.config.ts)
- PostgreSQL and Redis must start before application servers
- First-time setup only needs to be done once
- Migrations are only needed when schema changes
