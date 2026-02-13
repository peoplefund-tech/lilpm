# Claude Code Configuration

This directory contains configuration and skills for Claude Code.

## Directory Structure

```
.claude/
├── README.md                           # This file
└── skills/                             # Reusable skills
    ├── README.md                       # Skills documentation
    └── supabase-to-eks-migration.md   # EKS migration guide
```

## Skills

Skills are reusable knowledge documents that Claude Code can reference when working on specific tasks.

Current skills:
- **supabase-to-eks-migration.md**: Complete guide for migrating from Supabase to EKS

See `skills/README.md` for detailed information.

## Project Context

The main project context is maintained in the root `CLAUDE.md` file, which includes:
- Project overview and architecture
- Current progress status
- File structure
- Migration patterns
- How to resume work

## Local Development

Quick start:
```bash
# 1. Start services
brew services start postgresql redis

# 2. Terminal 1: API Server
cd server && npm run dev

# 3. Terminal 2: Collab Server  
cd collab-server && npm run dev

# 4. Terminal 3: Frontend
npm run dev

# 5. Open browser
open http://localhost:8080
```

## Documentation

- `CLAUDE.md` - Project context and progress
- `MIGRATION_PROGRESS.md` - Current migration status
- `.claude/skills/` - Reusable skills and guides
- `server/README.md` - API server documentation
- `collab-server/README.md` - Collab server documentation
