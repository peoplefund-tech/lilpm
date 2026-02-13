# LilPM Skills

This directory contains reusable skills for working with the LilPM codebase.

## Available Skills

### 🚀 local-development.md

Complete guide for starting and managing LilPM local development servers.

**Use this skill when:**
- Starting development servers for the first time
- Troubleshooting local environment issues
- Setting up PostgreSQL and Redis
- Running database migrations
- Testing the full application stack locally
- Debugging server connectivity issues

**Key Topics:**
- Prerequisites installation (PostgreSQL, Redis)
- First-time database setup
- Starting all services (API, Collab, Frontend)
- Health checks and verification
- Common issues and solutions
- Development workflow tips

**Quick Reference:**
```bash
# Start infrastructure
brew services start postgresql redis

# Three terminals:
# Terminal 1: cd server && npm run dev
# Terminal 2: cd collab-server && npm run dev
# Terminal 3: npm run dev

# Access at http://localhost:8080
```

### 🔄 supabase-to-eks-migration.md

Complete guide for migrating from Supabase to AWS EKS infrastructure.

**Use this skill when:**
- Migrating Supabase code to API client
- Creating new API routes in Fastify
- Understanding the migration architecture
- Converting service files from Supabase to apiClient
- Handling authentication migration

**Key Topics:**
- Architecture comparison (Before/After)
- Database migration with Drizzle
- API server development patterns
- Frontend service migration patterns
- WebSocket/realtime migration
- Docker & Kubernetes deployment

**Quick Reference:**
```bash
# Supabase → apiClient conversion
supabase.from('table').select()  → apiClient.get('/endpoint')
supabase.from('table').insert()  → apiClient.post('/endpoint', data)
supabase.auth.getUser()          → apiClient.get('/auth/me')
```

## Using Skills

To use a skill, simply tell Claude Code:
- "Use the supabase-to-eks-migration skill"
- "Follow the migration guide"
- "Help me migrate this service using the skill"

Or Claude will automatically use relevant skills when working on related tasks.

## Skill Structure

Each skill is a markdown file containing:
1. Overview and use cases
2. Step-by-step instructions
3. Code examples and patterns
4. Common issues and solutions
5. Quick reference commands

## Contributing

When creating new skills:
1. Use clear, descriptive filenames
2. Include an overview section
3. Provide code examples
4. Document common pitfalls
5. Add quick reference section
