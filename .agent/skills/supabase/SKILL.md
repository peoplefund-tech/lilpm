---
name: Supabase Development
description: Supabase 스키마, RLS, Edge Functions 전문 개발
triggers:
  - migration 파일 생성 요청
  - RLS 정책 추가
  - Edge Function 생성/수정
---

# Supabase 개발 스킬

## 🎯 이 스킬 활성화 조건
- 마이그레이션 SQL 작성 시
- user_id 참조하는 테이블 생성 시
- Edge Function TypeScript 작성 시

## ⚠️ CRITICAL: FK 제약조건

### 필수 규칙
**auth.users를 참조하는 모든 FK에 ON DELETE 명시 필수!**

```sql
-- 레코드도 삭제되어야 할 때:
user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE

-- 레코드는 유지하되 참조만 해제:
created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
```

### CASCADE vs SET NULL 선택 가이드
| Column Type | Action | Example |
|-------------|--------|---------|
| `user_id` (소유권) | CASCADE | profiles, notifications |
| `created_by` | SET NULL | issues, projects, prds |
| `assigned_to` | SET NULL | issues |
| `invited_by` | SET NULL | team_invites |

## 📋 테이블 생성 체크리스트

1. [ ] FK에 ON DELETE CASCADE/SET NULL 명시
2. [ ] 인덱스 전략 정의 (team_id, user_id, status 등)
3. [ ] RLS 정책 함께 생성
4. [ ] delete-users Edge Function 업데이트 필요 여부 확인

## 📚 RLS 정책 템플릿

```sql
-- 팀 멤버만 접근
CREATE POLICY "Team members only" ON [TABLE]
  FOR ALL USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- 본인만 접근
CREATE POLICY "Own records only" ON [TABLE]
  FOR ALL USING (user_id = auth.uid());

-- 생성자 또는 팀 관리자
CREATE POLICY "Creator or admin" ON [TABLE]
  FOR ALL USING (
    created_by = auth.uid() OR
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
```

## 🔧 Edge Function 템플릿

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    
    // 로직 구현

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

## 🚀 배포 명령어

```bash
# JWT 검증 필요한 함수
supabase functions deploy [function-name]

# 비인증 접근 허용 (get-invite-preview 등)
supabase functions deploy [function-name] --no-verify-jwt
```

## 🔄 캐싱 & 최적화

### 쿼리 최적화
```typescript
// ❌ 피해야 할 패턴
const { data } = await supabase.from('profiles').select('*');

// ✅ 필요한 컬럼만 선택
const { data } = await supabase
  .from('profiles')
  .select('id, name, email, avatar_url');
```

### FK 조인 문법
```typescript
// ✅ 간단한 컬럼 참조 (권장)
.select(`
  *,
  profile:profiles(id, name, email)
`)

// ❌ 명시적 FK 이름 (에러 발생 가능)
.select(`
  *,
  profile:profiles!team_members_user_id_fkey(*)
`)
```

### 클라이언트 캐싱
- React Query나 SWR 사용
- 5분 TTL로 팀/멤버 데이터 캐싱
- Stale-While-Revalidate 패턴 적용
