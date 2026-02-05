# 🔌 API 설계

> Supabase + Edge Functions 기반 API

## 개요

LilPM은 Supabase를 BaaS(Backend-as-a-Service)로 사용합니다:
- **Database**: PostgreSQL + PostgREST (자동 REST API)
- **Auth**: Supabase Auth
- **Edge Functions**: AI 프록시, 커스텀 로직

## 서비스 레이어

프론트엔드는 서비스 레이어를 통해 Supabase와 통신합니다:

```
┌─────────────────────┐
│     React 컴포넌트   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    Zustand Store    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Service Layer     │ ← issueService, prdService 등
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Supabase Client   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│   Supabase REST     │     │   Edge Functions    │
└─────────────────────┘     └─────────────────────┘
```

## 주요 API 패턴

### 1. 목록 조회

```typescript
// issueService.ts
export async function getIssues(teamId: string, filters?: IssueFilters) {
  let query = supabase
    .from('issues')
    .select(`
      *,
      assignee:assignee_id(*),
      project:project_id(id, name, color)
    `)
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  
  if (filters?.status) {
    query = query.in('status', filters.status);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
```

### 2. 생성

```typescript
export async function createIssue(teamId: string, input: CreateIssueInput) {
  const { data, error } = await supabase
    .from('issues')
    .insert({
      team_id: teamId,
      ...input,
      creator_id: (await supabase.auth.getUser()).data.user?.id,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
```

### 3. 수정

```typescript
export async function updateIssue(issueId: string, updates: Partial<Issue>) {
  const { data, error } = await supabase
    .from('issues')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', issueId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
```

### 4. 삭제

```typescript
export async function deleteIssue(issueId: string) {
  const { error } = await supabase
    .from('issues')
    .delete()
    .eq('id', issueId);
  
  if (error) throw error;
}
```

## Edge Functions

### lily-chat
AI 채팅 프록시

```typescript
// supabase/functions/lily-chat/index.ts
Deno.serve(async (req) => {
  const { messages, provider, stream } = await req.json();
  
  // API 키 가져오기
  const apiKey = await getUserApiKey(userId, provider);
  
  // AI 제공자별 처리
  switch (provider) {
    case 'anthropic':
      return handleAnthropic(messages, apiKey, stream);
    case 'openai':
      return handleOpenAI(messages, apiKey, stream);
    case 'gemini':
      return handleGemini(messages, apiKey, stream);
  }
});

// 스트리밍 응답
function handleAnthropic(messages, apiKey, stream) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      messages,
      stream: true,
    }),
  });
  
  return new Response(response.body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

## 실시간 구독

Supabase Realtime으로 실시간 업데이트:

```typescript
// 이슈 변경 구독
const subscription = supabase
  .channel('issues')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'issues' },
    (payload) => {
      // 상태 업데이트
      handleIssueChange(payload);
    }
  )
  .subscribe();
```

## 에러 처리

```typescript
// 공통 에러 처리
export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
  }
}

// 서비스에서 사용
try {
  const data = await issueService.createIssue(teamId, input);
} catch (error) {
  if (error.code === 'PGRST116') {
    // 레코드 없음
    toast.error('이슈를 찾을 수 없습니다');
  } else if (error.code === '23505') {
    // 중복 키
    toast.error('이미 존재하는 이슈입니다');
  } else {
    toast.error('오류가 발생했습니다');
  }
}
```

## API 응답 타입

```typescript
// types/index.ts

export interface Issue {
  id: string;
  team_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  // Relations
  assignee?: User;
  project?: Project;
}

export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'done' | 'canceled';
export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low' | 'no_priority';
```

---

**관련 문서**
- [프론트엔드 아키텍처](./frontend.md)
- [데이터베이스 스키마](./database.md)
