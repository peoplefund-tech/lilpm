# 데이터베이스 스키마

> Supabase PostgreSQL 기반 데이터 모델 (30+ 테이블)

## ERD 개요

```
┌───────────┐     ┌──────────────┐     ┌───────────┐
│  auth.users│────<│ team_members │>────│   teams    │
└─────┬─────┘     └──────────────┘     └─────┬─────┘
      │                  │                    │
      ▼                  ▼                    │
┌───────────┐     ┌──────────────┐            │
│  profiles  │     │ team_invites │            │
└───────────┘     │(project_ids) │            │
      │           └──────────────┘            │
      │                                       ▼
      │                               ┌───────────┐     ┌────────────────┐
      │                               │  projects  │────<│project_members │
      │                               └─────┬─────┘     └────────────────┘
      │                                     │
      │            ┌────────────────────────┼──────────────────┐
      │            ▼                        ▼                  ▼
      │     ┌───────────┐          ┌──────────────┐    ┌───────────┐
      │     │   issues   │──────<──│prd_documents │    │  cycles   │
      │     └─────┬─────┘          └──────┬───────┘    └───────────┘
      │           │                       │
      │  ┌───────┼────────┬───────┐      ▼
      │  ▼       ▼        ▼       ▼  ┌──────────────┐
      │ deps  comments activities │  │ prd_projects │
      │ labels templates versions │  └──────────────┘
      │                           │
      ▼                           ▼
┌──────────────┐          ┌──────────────┐
│ conversations│          │ prd_versions │
│  + messages  │          │ prd_yjs_state│
│  + shares    │          └──────────────┘
└──────────────┘
                    ┌──────────────┐
                    │notifications │
                    │activity_logs │
                    └──────────────┘

┌──────────────┐
│  databases   │ (Notion-style)
│  properties  │
│  rows        │
│  views       │
└──────────────┘

┌──────────────┐
│block_comments│
│  + replies   │
│  + reactions │
└──────────────┘
```

---

## Core 테이블

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

### profiles

사용자 프로필 (auth.users 미러)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 트리거로 auth.users와 자동 동기화
```

### teams

팀/워크스페이스

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  issue_prefix TEXT,  -- 이슈 번호 접두사 (예: LPM)
  avatar_url TEXT,
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
  role TEXT CHECK (role IN ('owner', 'admin', 'member', 'guest')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);
```

### team_invites

팀 초대

```sql
CREATE TABLE team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'member', 'guest')) DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')) DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id),
  project_ids UUID[] DEFAULT NULL,  -- 선택적 프로젝트 할당 목록
  expires_at TIMESTAMPTZ NOT NULL,  -- 생성 후 24시간
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_team_invites_token ON team_invites(token);
CREATE INDEX idx_team_invites_email ON team_invites(email);
```

> **2026-02-10 추가**: `project_ids` 컬럼 - 초대 시 특정 프로젝트만 할당 가능. NULL이면 자동 할당 트리거가 모든 프로젝트에 할당.

### projects

프로젝트

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,  -- 이모지 아이콘
  color TEXT DEFAULT '#6366f1',
  status TEXT CHECK (status IN ('active', 'archived')) DEFAULT 'active',
  start_date DATE,
  target_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### project_members

프로젝트별 멤버 할당 (접근 제어용)

```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer')),
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
```

---

## Issue 관련 테이블

### issues

이슈/티켓

```sql
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,
  prd_id UUID REFERENCES prd_documents(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES issues(id) ON DELETE CASCADE,

  -- 식별자
  identifier TEXT,  -- 예: LPM-123

  -- 기본 정보
  title TEXT NOT NULL,
  description TEXT,

  -- 타입
  type TEXT CHECK (type IN ('epic', 'user_story', 'task', 'subtask', 'bug')) DEFAULT 'task',

  -- 상태
  status TEXT CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled')) DEFAULT 'backlog',
  priority TEXT CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')) DEFAULT 'none',

  -- 담당
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 일정
  start_date DATE,
  due_date DATE,
  estimate INTEGER,  -- 스토리 포인트

  -- 정렬
  sort_order FLOAT,

  -- 아카이브
  archived_at TIMESTAMPTZ,  -- NULL이면 활성, 값이 있으면 아카이브됨

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_issues_team ON issues(team_id);
CREATE INDEX idx_issues_project ON issues(project_id);
CREATE INDEX idx_issues_cycle ON issues(cycle_id);
CREATE INDEX idx_issues_prd ON issues(prd_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_assignee ON issues(assignee_id);
```

### issue_dependencies

이슈 간 의존성 (간트 차트 연결)

```sql
CREATE TABLE issue_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocking_issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  blocked_issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'blocks',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocking_issue_id, blocked_issue_id)
);
```

### labels

이슈 라벨

```sql
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### issue_labels

이슈-라벨 다대다

```sql
CREATE TABLE issue_labels (
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, label_id)
);
```

### comments

이슈 댓글

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### activities

이슈 활동 로그

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,  -- status_changed, assigned, comment_added 등
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### issue_templates

이슈 템플릿

```sql
CREATE TABLE issue_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_type TEXT,
  default_priority TEXT,
  default_status TEXT,
  template_content TEXT,  -- 설명 템플릿 (Markdown)
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### issue_versions

이슈 버전 히스토리

```sql
CREATE TABLE issue_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  status TEXT,
  priority TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changes JSONB,  -- 변경 내역 상세
  created_at TIMESTAMPTZ DEFAULT now()
);
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

---

## PRD 관련 테이블

### prd_documents

PRD 문서

```sql
CREATE TABLE prd_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  content TEXT,        -- TipTap JSON 또는 HTML
  overview TEXT,       -- 미리보기 텍스트 (목록 표시용)

  status TEXT CHECK (status IN ('draft', 'in_review', 'approved', 'archived')) DEFAULT 'draft',

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,  -- NULL이면 활성
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### prd_projects

PRD-프로젝트 다대다 연결

```sql
CREATE TABLE prd_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id UUID REFERENCES prd_documents(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(prd_id, project_id)
);
```

### prd_versions

PRD 버전 히스토리

```sql
CREATE TABLE prd_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id UUID REFERENCES prd_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT,
  content TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### prd_yjs_state

Yjs 실시간 협업 상태

```sql
CREATE TABLE prd_yjs_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id UUID REFERENCES prd_documents(id) ON DELETE CASCADE,
  state BYTEA NOT NULL,  -- Yjs 문서 상태 바이너리
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(prd_id)
);
```

---

## 블록 댓글 테이블

### block_comments

블록 레벨 댓글 (에디터 내 인라인 댓글)

```sql
CREATE TABLE block_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,  -- 'prd' | 'issue'
  entity_id UUID NOT NULL,
  block_id TEXT,  -- TipTap 블록 ID
  content TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### block_comment_replies

블록 댓글 답글

```sql
CREATE TABLE block_comment_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES block_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### block_comment_reactions

블록 댓글 리액션 (2026-02-10 추가)

```sql
CREATE TABLE block_comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES block_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id, emoji)
);
```

---

## AI & 대화 테이블

### user_ai_settings

사용자 AI 설정

```sql
CREATE TABLE user_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- API 키
  anthropic_api_key TEXT,
  openai_api_key TEXT,
  gemini_api_key TEXT,

  -- 설정
  default_provider TEXT DEFAULT 'auto',
  auto_mode_enabled BOOLEAN DEFAULT true,

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
  is_pinned BOOLEAN DEFAULT false,
  sort_order FLOAT,  -- 드래그 재정렬용

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_team ON conversations(team_id);
```

### messages

대화 메시지

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,

  role TEXT CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
  content TEXT NOT NULL,
  thinking_content TEXT,     -- Claude thinking 블록
  suggested_issues JSONB,    -- AI 제안 이슈 목록

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
```

### conversation_shares

대화 공유 링크

```sql
CREATE TABLE conversation_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES auth.users(id),

  share_token TEXT UNIQUE NOT NULL,
  is_public BOOLEAN DEFAULT false,
  allow_comments BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conversation_shares_token ON conversation_shares(share_token);
```

### conversation_access_requests

대화 접근 요청

```sql
CREATE TABLE conversation_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),

  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  message TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 알림 & 활동 테이블

### notifications

인앱 알림

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  type TEXT NOT NULL,  -- prd_mentioned, issue_assigned, comment_added, etc.
  title TEXT NOT NULL,
  message TEXT,

  entity_type TEXT,  -- prd, issue, team, etc.
  entity_id UUID,
  data JSONB,

  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;
```

### activity_logs

팀 레벨 활동 로그

```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  entity_title TEXT,
  details JSONB,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_logs_team ON activity_logs(team_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
```

---

## Database (Notion-style) 테이블

### databases

데이터베이스 메타데이터

```sql
CREATE TABLE databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### database_properties

데이터베이스 컬럼/필드 정의

```sql
CREATE TABLE database_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID REFERENCES databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- text, number, date, select, multi_select, person, checkbox, url, email, phone, formula, relation, rollup
  options JSONB,       -- select 옵션, formula 설정 등
  position INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  -- Rollup 설정 (2026-02-10 추가)
  rollup_relation_property_id UUID,
  rollup_target_property_id UUID,
  rollup_function TEXT,  -- count, sum, avg, min, max
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### database_rows

데이터베이스 레코드

```sql
CREATE TABLE database_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID REFERENCES databases(id) ON DELETE CASCADE,
  properties JSONB DEFAULT '{}',  -- { property_id: value }
  parent_id UUID REFERENCES database_rows(id) ON DELETE CASCADE,  -- Sub-items (2026-02-10 추가)
  position INTEGER DEFAULT 0,     -- 정렬 순서 (2026-02-10 추가)
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### database_views

데이터베이스 뷰 설정

```sql
CREATE TABLE database_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID REFERENCES databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- table, board, calendar, list, gallery, timeline, chart, form
  config JSONB,        -- 뷰별 설정 (필터, 정렬, 그룹화 등)
  filters JSONB,
  sorts JSONB,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## RPC 함수

### create_team_with_owner

팀 생성 시 생성자를 Owner로 자동 추가:

```sql
CREATE OR REPLACE FUNCTION create_team_with_owner(
  _name text, _slug text, _issue_prefix text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_team_id uuid;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  INSERT INTO teams (name, slug, issue_prefix) VALUES (_name, _slug, COALESCE(_issue_prefix, UPPER(LEFT(_slug, 3))))
  RETURNING id INTO new_team_id;
  INSERT INTO team_members (team_id, user_id, role) VALUES (new_team_id, current_user_id, 'owner')
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'owner';
  RETURN json_build_object('id', new_team_id, 'name', _name, 'slug', _slug);
END; $$;
```

### get_invite_preview

비인증 유저의 초대 미리보기 (SECURITY DEFINER):

```sql
CREATE OR REPLACE FUNCTION get_invite_preview(invite_token TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
-- RLS를 우회하여 초대 정보 반환
-- 팀 이름, 초대자 이름, 상태, 만료 여부
$$;
```

### RLS 헬퍼 함수

```sql
-- 팀 멤버 확인 (무한 재귀 방지)
CREATE OR REPLACE FUNCTION is_team_member_safe(check_team_id uuid, check_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM team_members WHERE team_id = check_team_id AND user_id = check_user_id);
$$;

-- 팀 관리자 확인
CREATE OR REPLACE FUNCTION is_team_admin_safe(check_team_id uuid, check_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM team_members WHERE team_id = check_team_id AND user_id = check_user_id AND role IN ('owner', 'admin'));
$$;

-- 프로젝트 멤버 확인
CREATE OR REPLACE FUNCTION is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM project_members WHERE project_id = _project_id AND user_id = _user_id);
$$;

-- 프로젝트의 팀 관리자 확인
CREATE OR REPLACE FUNCTION is_team_admin_for_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members tm JOIN projects p ON p.team_id = tm.team_id
    WHERE p.id = _project_id AND tm.user_id = _user_id AND tm.role IN ('owner', 'admin')
  );
$$;
```

### 이슈 식별자 생성

```sql
CREATE OR REPLACE FUNCTION generate_issue_identifier(_team_id uuid)
RETURNS text LANGUAGE plpgsql AS $$
-- team의 issue_prefix + 순차 번호 생성 (예: LPM-123)
$$;
```

### 아카이브 관리

```sql
-- 아이템 아카이브
CREATE OR REPLACE FUNCTION archive_item(p_item_type text, p_item_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
-- issues 또는 prd_documents의 archived_at을 현재 시각으로 설정
$$;

-- 아이템 복원
CREATE OR REPLACE FUNCTION restore_item(p_item_type text, p_item_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
-- archived_at을 NULL로 설정
$$;

-- 아카이브 목록 조회
CREATE OR REPLACE FUNCTION get_archived_items(p_team_id uuid)
RETURNS json LANGUAGE plpgsql AS $$
-- 아카이브된 이슈와 PRD 목록 반환
$$;

-- 만료 아카이브 정리 (30일)
CREATE OR REPLACE FUNCTION cleanup_expired_archives()
RETURNS void LANGUAGE plpgsql AS $$
-- 30일 경과된 아카이브 항목 삭제
$$;
```

### 팀 Owner 보장

```sql
CREATE OR REPLACE FUNCTION ensure_current_user_is_owner_if_no_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
-- 팀에 Owner가 없으면 현재 사용자를 Owner로 승격
$$;
```

---

## Row Level Security (RLS)

모든 테이블에 RLS 적용:

### 기본 패턴

```sql
-- 팀 멤버만 접근 (재귀 방지용 헬퍼 함수 사용)
CREATE POLICY "Team members can access" ON issues
  FOR ALL USING (
    is_team_member_safe(team_id, auth.uid())
  );

-- 프로젝트 멤버 + 팀 admin 접근
CREATE POLICY "Project members or team admins" ON projects
  FOR SELECT USING (
    is_project_member(id, auth.uid()) OR is_team_admin_for_project(id, auth.uid())
  );

-- 본인 데이터만 접근
CREATE POLICY "Users can access own data" ON user_ai_settings
  FOR ALL USING (user_id = auth.uid());

-- 초대 토큰으로 조회 허용
CREATE POLICY "Anyone can view invite by token" ON team_invites
  FOR SELECT USING (true);  -- get-invite-preview Edge Function에서 Service Role 사용
```

### RLS 적용 테이블 목록

| 테이블 | 정책 |
|--------|------|
| profiles | 모든 인증 유저 조회, 본인만 수정 |
| teams | 팀 멤버만 조회 |
| team_members | 팀 멤버 조회, admin 이상 수정 |
| team_invites | 토큰 기반 조회 허용 |
| projects | 프로젝트 멤버 또는 팀 admin |
| project_members | 프로젝트 멤버 또는 팀 admin |
| issues | 팀 멤버 (+ 프로젝트 멤버 필터링) |
| labels, cycles | 팀 멤버 |
| comments, activities | 팀 멤버 |
| prd_documents | 팀 멤버 |
| notifications | 본인만 |
| conversations, messages | 본인만 |
| user_ai_settings | 본인만 |
| databases, database_* | 팀 멤버 |
| block_comments, replies, reactions | 팀 멤버 |

---

## Edge Functions

| 함수명 | 용도 | JWT 검증 |
|--------|------|----------|
| `accept-invite-v2` | 초대 수락 (인증/매직링크/회원가입, 프로젝트 할당) | No |
| `get-invite-preview` | 초대 미리보기 (RLS 우회, Service Role) | No |
| `send-team-invite` | 팀 초대 이메일 발송 (Gmail SMTP) | No |
| `send-mention-email` | @멘션 이메일 발송 (Gmail SMTP) | No |
| `send-member-removed` | 멤버 제거 이메일 (Resend/Gmail SMTP) | No |
| `send-notification-email` | 7가지 알림 이메일 (Gmail SMTP) | No |
| `lily-chat` | AI 채팅 (Claude/GPT-4o/Gemini, 스트리밍) | No |
| `mcp-proxy` | MCP 서버 프록시 | No |
| `delete-users` | 유저 완전 삭제 (13개 테이블 순차 삭제) | No |

---

## 인덱스 전략

### 기본 인덱스
```sql
CREATE INDEX idx_issues_team_status ON issues(team_id, status);
CREATE INDEX idx_issues_assignee ON issues(assignee_id);
CREATE INDEX idx_issues_dates ON issues(start_date, due_date);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_invites_token ON team_invites(token);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
```

### 성능 최적화 인덱스 (20260210160000_performance_indexes.sql)

15+ 추가 복합/부분 인덱스:

```sql
-- 부분 인덱스 (아카이브 제외)
CREATE INDEX idx_issues_project_status ON issues(project_id, status) WHERE archived_at IS NULL;
CREATE INDEX idx_issues_assignee_status ON issues(assignee_id, status) WHERE archived_at IS NULL AND assignee_id IS NOT NULL;
CREATE INDEX idx_prd_documents_team_created ON prd_documents(team_id, created_at DESC) WHERE archived_at IS NULL;
CREATE INDEX idx_team_invites_status_pending ON team_invites(team_id) WHERE status = 'pending';

-- 복합 인덱스 (정렬 포함)
CREATE INDEX idx_notifications_user_read_created ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_activities_issue_created ON activities(issue_id, created_at DESC);
CREATE INDEX idx_activity_logs_team_created ON activity_logs(team_id, created_at DESC);
CREATE INDEX idx_comments_issue_created ON comments(issue_id, created_at DESC);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_conversations_user_updated ON conversations(user_id, updated_at DESC);

-- GIN 인덱스 (JSONB)
CREATE INDEX idx_database_rows_properties_gin ON database_rows USING GIN (properties);
CREATE INDEX idx_database_rows_db_position ON database_rows(database_id, position);

-- 기타
CREATE INDEX idx_issues_parent_id ON issues(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_issues_cycle_status ON issues(cycle_id, status) WHERE cycle_id IS NOT NULL;
CREATE INDEX idx_block_comments_document ON block_comments(document_type, document_id);
CREATE INDEX idx_project_members_project_user ON project_members(project_id, user_id);
```

> 자세한 내용: [성능 최적화 가이드](./performance.md)

---

## FK 규칙 (중요)

```sql
-- 유저 ID (CASCADE) - 유저 삭제 시 관련 데이터 함께 삭제
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE

-- 소유/할당 (SET NULL) - 유저 삭제 시 NULL로 설정 (데이터 보존)
created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL
assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
```

---

**관련 문서**
- [프론트엔드 아키텍처](./frontend.md)
- [API 설계](./api.md)
- [마이그레이션 가이드](./migrations.md)
- [팀 멤버 관리](../features/team-members.md)
