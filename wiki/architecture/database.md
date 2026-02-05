# 🗄️ 데이터베이스 스키마

> Supabase PostgreSQL 기반 데이터 모델

## ERD 개요

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   users     │────<│ team_members│>────│   teams     │
└─────────────┘     └─────────────┘     └─────────────┘
      │                                        │
      │                                        │
      ▼                                        ▼
┌─────────────┐                         ┌─────────────┐
│user_settings│                         │  projects   │
└─────────────┘                         └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────┐
                    ▼                         ▼                 ▼
             ┌─────────────┐          ┌─────────────┐    ┌─────────────┐
             │   issues    │          │    prds     │    │   cycles    │
             └─────────────┘          └─────────────┘    └─────────────┘
                    │
                    ▼
             ┌─────────────┐
             │dependencies │
             └─────────────┘
```

## 주요 테이블

### users (Supabase Auth)
Supabase Auth에서 관리하는 사용자 테이블

```sql
-- auth.users (Supabase 관리)
id UUID PRIMARY KEY
email TEXT UNIQUE
email_confirmed_at TIMESTAMPTZ
raw_user_meta_data JSONB  -- { name: string }
created_at TIMESTAMPTZ
```

### teams
팀/워크스페이스

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### team_members
팀 멤버십 (다대다 관계)

```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);
```

### projects
프로젝트

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  status TEXT CHECK (status IN ('active', 'archived')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### issues
이슈/티켓

```sql
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,
  
  -- 기본 정보
  title TEXT NOT NULL,
  description TEXT,
  
  -- 상태
  status TEXT CHECK (status IN ('backlog', 'todo', 'in_progress', 'done', 'canceled')) DEFAULT 'backlog',
  priority TEXT CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'no_priority')) DEFAULT 'no_priority',
  
  -- 담당
  assignee_id UUID REFERENCES auth.users(id),
  creator_id UUID REFERENCES auth.users(id),
  
  -- 일정
  start_date DATE,
  due_date DATE,
  
  -- 정렬
  sort_order NUMERIC,
  
  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_issues_team ON issues(team_id);
CREATE INDEX idx_issues_project ON issues(project_id);
CREATE INDEX idx_issues_status ON issues(status);
```

### cycles
사이클/스프린트

```sql
CREATE TABLE cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT CHECK (status IN ('upcoming', 'active', 'completed')) DEFAULT 'upcoming',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### prds
PRD 문서

```sql
CREATE TABLE prds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  title TEXT NOT NULL,
  content TEXT,  -- HTML 또는 JSON
  overview TEXT, -- 레거시 호환
  
  status TEXT CHECK (status IN ('draft', 'review', 'approved', 'archived')) DEFAULT 'draft',
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### dependencies
이슈 간 의존성

```sql
CREATE TABLE dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocking_issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  blocked_issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocking_issue_id, blocked_issue_id)
);
```

### user_settings
사용자 설정 (AI 키 포함)

```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- AI 설정
  anthropic_api_key TEXT,
  openai_api_key TEXT,
  gemini_api_key TEXT,
  default_provider TEXT DEFAULT 'auto',
  auto_mode_enabled BOOLEAN DEFAULT true,
  
  -- 기타 설정
  theme TEXT DEFAULT 'system',
  language TEXT DEFAULT 'ko',
  
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### conversations
Lily 대화 기록

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  title TEXT,
  messages JSONB DEFAULT '[]',
  is_pinned BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Row Level Security (RLS)

모든 테이블에 RLS 적용:

```sql
-- 팀 멤버만 접근 가능
CREATE POLICY "Team members can access" ON issues
  FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- 본인 설정만 접근
CREATE POLICY "Users can access own settings" ON user_settings
  FOR ALL
  USING (user_id = auth.uid());
```

## 인덱스 전략

```sql
-- 자주 사용하는 쿼리 패턴
CREATE INDEX idx_issues_team_status ON issues(team_id, status);
CREATE INDEX idx_issues_assignee ON issues(assignee_id);
CREATE INDEX idx_issues_dates ON issues(start_date, due_date);
CREATE INDEX idx_team_members_user ON team_members(user_id);
```

---

**관련 문서**
- [프론트엔드 아키텍처](./frontend.md)
- [API 설계](./api.md)
