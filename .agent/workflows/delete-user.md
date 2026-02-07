---
description: 유저 ID를 주면서 삭제 요청할 때 사용하는 워크플로우
---

# 유저 삭제 워크플로우

## 사전 점검 (매번 필수!)

1. **새 테이블 확인**: 스키마에 user_id 참조하는 새 테이블이 추가되었는지 확인
   ```bash
   grep -r "user_id\|user\.id\|REFERENCES auth.users" supabase/migrations/*.sql | tail -20
   ```

2. **delete-users Edge Function 업데이트 필요 시**:
   - 파일 위치: `supabase/functions/delete-users/index.ts`
   - 새 테이블의 user_id 참조를 DELETE 또는 UPDATE(nullable일 경우 null로)
   - 순서 중요: profiles와 auth.users 삭제 전에 다른 테이블 먼저 처리

3. **업데이트했다면 배포**:
   ```bash
   // turbo
   supabase functions deploy delete-users --no-verify-jwt
   ```

## 유저 삭제 실행

// turbo
```bash
curl -X POST "https://lbzjnhlribtfwnoydpdv.supabase.co/functions/v1/delete-users" \
  -H "Content-Type: application/json" \
  -d '{"user_ids": ["INSERT_USER_ID_HERE"]}'
```

## 현재 처리되는 테이블 목록 (2026-02-07 기준)

1. user_ai_settings
2. prd_documents
3. prd_projects  
4. team_members
5. team_invites
6. issues (assignee_id, creator_id)
7. activity_logs
8. notifications
9. conversation_access_requests
10. conversation_shares
11. conversations (cascade deletes messages)
12. profiles
13. auth.users

## 주의사항

- **절대 직접 SQL로 auth.users 삭제하지 말 것** - FK 제약조건 위반 발생
- Edge Function이 올바른 순서로 정리하고 admin API로 삭제함
