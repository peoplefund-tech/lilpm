# Performance Optimization Guide

## Overview
LilPM uses Vite 5.x with advanced build optimization for fast loading and efficient caching.

## Bundle Architecture

### Vendor Chunks (manualChunks)
| Chunk | Contents | Size (gzip) |
|-------|----------|-------------|
| react-vendor | react, react-dom, react-router-dom | ~53KB |
| supabase | @supabase/supabase-js | ~45KB |
| editor | TipTap rich text editor | ~123KB |
| ui-radix | Radix UI primitives | ~36KB |
| icons | lucide-react | ~12KB |
| form | react-hook-form, zod | ~22KB |
| date | date-fns | ~8KB |
| i18n | i18next | ~16KB |

### Route-based Code Splitting
All major pages use `React.lazy()` for on-demand loading:

```typescript
const DashboardPage = React.lazy(() => 
  import("./pages/DashboardPage").then(m => ({ default: m.DashboardPage }))
);
```

## Loading Strategy

### Immediate Load (Critical Path)
- Auth pages (Login, Signup)
- LandingPage
- Onboarding pages

### Lazy Load (On Navigation)
- DashboardPage
- IssuesPage, IssueDetailPage
- PRDPage, PRDDetailPage
- LilyPage
- Settings pages
- All other feature pages

## Suspense Fallback
```tsx
<Suspense fallback={<PageLoader />}>
  <Routes>
    {/* All routes */}
  </Routes>
</Suspense>
```

## Caching Strategy

### Browser Caching
- Vendor chunks have content hashes for long-term caching
- When vendor libraries don't change, browsers use cached versions

### In-Memory Caching
- Team member data cached with 5-minute TTL
- Stale-While-Revalidate pattern for frequently accessed data

## Database Performance Indexes

### 20260210160000_performance_indexes.sql

쿼리 성능을 위해 15+ 복합 인덱스 추가:

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| notifications | `(user_id, read, created_at DESC)` | 읽지 않은 알림 조회 |
| notifications | `(user_id, type)` | 유형별 알림 필터 |
| activities | `(issue_id, created_at DESC)` | 이슈 활동 피드 |
| activity_logs | `(team_id, created_at DESC)` | 팀 활동 타임라인 |
| activity_logs | `(user_id, created_at DESC)` | 유저 활동 조회 |
| issues | `(project_id, status) WHERE archived_at IS NULL` | 프로젝트별 이슈 |
| issues | `(assignee_id, status) WHERE archived_at IS NULL` | 담당자별 이슈 |
| issues | `(cycle_id, status) WHERE cycle_id IS NOT NULL` | 사이클별 이슈 |
| issues | `(parent_id) WHERE parent_id IS NOT NULL` | 서브이슈 조회 |
| team_invites | `(email)` | 이메일 기반 초대 조회 |
| team_invites | `(team_id) WHERE status = 'pending'` | 대기중 초대 |
| database_rows | `GIN (properties)` | JSONB 유연 쿼리 |
| database_rows | `(database_id, position)` | DB 행 정렬 |
| comments | `(issue_id, created_at DESC)` | 이슈 댓글 |
| prd_documents | `(team_id, created_at DESC) WHERE archived_at IS NULL` | PRD 목록 |
| messages | `(conversation_id, created_at ASC)` | 대화 메시지 |
| conversations | `(user_id, updated_at DESC)` | 대화 목록 |
| project_members | `(project_id, user_id)` | 멤버십 확인 |
| block_comments | `(document_type, document_id)` | 블록 댓글 |

### Partial Index 전략

아카이브된 데이터를 제외하는 부분 인덱스 사용:
```sql
-- 활성 이슈만 인덱싱
CREATE INDEX idx_issues_project_status
  ON issues (project_id, status) WHERE archived_at IS NULL;
```

### GIN Index (JSONB)

Notion-style Database의 유연한 JSONB 쿼리를 위한 GIN 인덱스:
```sql
CREATE INDEX idx_database_rows_properties_gin
  ON database_rows USING GIN (properties);
```

## Performance Metrics
| Metric | Target | Current |
|--------|--------|---------|
| Initial Bundle | <200KB | ~156KB (index.js) |
| First Contentful Paint | <1.5s | ~1.2s |
| Time to Interactive | <3s | ~2.5s |

## Configuration

### vite.config.ts
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'supabase': ['@supabase/supabase-js'],
        // ... more chunks
      }
    }
  }
}
```

## Edge Function 성능

### 공유 모듈 (`_shared/`)
모든 Edge Functions가 공유 모듈을 사용하여:
- 중복 코드 제거 (~30% 코드 감소)
- 일관된 에러 처리
- Gmail SMTP 연결 코드 단일화
- 환경 변수 접근 표준화

## Best Practices

1. **Dynamic Imports for Heavy Components**
   - Use `React.lazy()` for pages over 20KB
   
2. **Avoid Barrel Files**
   - Direct imports prevent tree-shaking issues
   
3. **Monitor Bundle Size**
   - Run `npm run build` to check chunk sizes
   - Keep index.js under 200KB

4. **Database Query Optimization**
   - Use partial indexes for filtered queries
   - GIN indexes for JSONB columns
   - Composite indexes for multi-column queries

---

**관련 문서**
- [프론트엔드 아키텍처](./frontend.md)
- [데이터베이스 스키마](./database.md)
- [API 설계](./api.md)
