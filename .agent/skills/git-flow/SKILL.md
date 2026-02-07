---
name: Git Flow
description: 커밋 컨벤션, 브랜치 전략
---

# Git 플로우 스킬

> [!CAUTION]
> ## 🚨 필수 규칙: 일괄 커밋
> **사용자가 2개 이상의 요청을 한 경우:**
> 1. **모든 수정을 완료**한 후
> 2. **한 번만** 빌드/커밋/푸시 실행
> 
> ❌ 요청마다 개별 커밋 금지
> ✅ 모든 요청 완료 후 단일 커밋

## 📝 커밋 메시지 규칙

```
<type>(<scope>): <subject>

<body>
```

### Type 목록
| Type | 용도 | 예시 |
|------|------|------|
| feat | 새 기능 | feat(lily): Add conversation sharing |
| fix | 버그 수정 | fix(auth): Handle session expiry |
| docs | 문서 수정 | docs: Update wiki |
| refactor | 리팩토링 | refactor(editor): Extract table utils |
| chore | 빌드/설정 | chore: Update dependencies |
| style | 코드 스타일 | style: Fix formatting |
| test | 테스트 | test: Add unit tests for issueService |

### Scope 예시
- `auth`: 인증 관련
- `lily`: Lily AI
- `editor`: TipTap 에디터
- `issues`: 이슈 관리
- `team`: 팀 관리

### 좋은 커밋 메시지 예시
```
feat(lily): Add conversation sharing with access control

- Added conversation_shares and conversation_access_requests tables
- Implemented ShareConversationModal component
- Added share token generation and validation
- Updated delete-users Edge Function to handle new tables
```

## 🔄 자동화

### auto-dev 워크플로우 활성화 시
`// turbo-all` 어노테이션으로 다음이 자동 실행됨:
- git add
- git commit
- git push
- npm 명령어
- supabase 명령어

### Vercel 자동 배포
- `main` 브랜치 푸시 시 자동 배포
- 배포 상태: https://vercel.com/dashboard

## 📋 푸시 전 체크리스트

1. [ ] `npm run build` 성공
2. [ ] 타입 에러 없음
3. [ ] 커밋 메시지 컨벤션 준수
4. [ ] Wiki 업데이트 필요 여부 확인

## 🚀 배포 순서

1. 빌드 확인:
```bash
npm run build
```

2. 커밋 & 푸시:
```bash
git add -A && git commit -m "feat: description" && git push
```

3. Edge Function 변경 시:
```bash
supabase functions deploy [function-name]
```

4. 마이그레이션 있을 시:
```bash
supabase db push
```
