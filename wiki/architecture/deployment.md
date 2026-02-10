# 배포 아키텍처

> Vercel + Supabase + Cloudflare Workers 3중 배포

## 배포 구성

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   Vercel     │     │    Supabase      │     │ Cloudflare Workers │
│  (Frontend)  │────►│   (Backend)      │     │   (Collaboration)  │
│              │     │                  │     │                    │
│ • React SPA  │     │ • PostgreSQL DB  │     │ • Yjs Durable Obj  │
│ • Static     │     │ • Auth           │     │ • WebSocket        │
│ • CDN        │     │ • Edge Functions │     │                    │
│ • CSP Headers│     │ • Realtime       │     │                    │
└──────────────┘     └──────────────────┘     └────────────────────┘
```

## Vercel (프론트엔드)

### 설정 (vercel.json)
- SPA 리라이트 (모든 경로 → index.html)
- CSP 헤더 설정
- 환경 변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`

### 빌드
```bash
npm run build  # Vite 프로덕션 빌드
```

### CI/CD
`.github/workflows/deploy.yml`로 자동 배포

## Supabase (백엔드)

### Edge Functions 배포

모든 Edge Functions는 `_shared/` 공유 모듈에 의존합니다. 배포 시 공유 모듈이 자동으로 번들됩니다.

```bash
# 개별 배포
supabase functions deploy accept-invite-v2 --no-verify-jwt
supabase functions deploy lily-chat --no-verify-jwt

# 전체 배포 (권장 - _shared/ 모듈 변경 시 모든 함수 재배포 필요)
supabase functions deploy --no-verify-jwt
```

> **중요**: `_shared/` 모듈 변경 시 의존하는 모든 Edge Functions를 재배포해야 합니다.

### 마이그레이션 적용
```bash
supabase db push
```

### 환경 변수 (Edge Functions)
```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
GMAIL_USER, GMAIL_APP_PASSWORD
RESEND_API_KEY (fallback)
SITE_URL
```

## Cloudflare Workers (협업)

### 배포
```bash
cd workers/collab
npx wrangler deploy
```

### 설정 (wrangler.toml)
- Durable Objects: YjsRoom
- Compatibility date 설정

---

**관련 문서**
- [환경 설정](../development/setup.md)
- [프론트엔드 아키텍처](./frontend.md)
