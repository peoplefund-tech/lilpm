# 🛠️ 개발 환경 설정

> LilPM 로컬 개발 환경 구축 가이드

## 사전 요구사항

- **Node.js** 18+ (LTS 권장)
- **npm** 또는 **pnpm**
- **Git**
- **Supabase 계정**

## 1. 저장소 클론

```bash
git clone https://github.com/jaehwapfct/lilpm.git
cd lilpm
```

## 2. 의존성 설치

```bash
npm install
# 또는
pnpm install
```

## 3. 환경 변수 설정

```bash
# 템플릿 복사
cp .env.example .env.local

# .env.local 편집
```

필수 환경 변수:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 사이트 URL (이메일 인증 리다이렉트용)
VITE_SITE_URL=http://localhost:5173
```

## 4. Supabase 설정

### 4.1. 프로젝트 생성

1. [Supabase](https://supabase.com) 접속
2. "New Project" 클릭
3. 프로젝트 정보 입력
4. API 키 복사

### 4.2. 데이터베이스 마이그레이션

```bash
# Supabase CLI 설치
npm install -g supabase

# 로그인
supabase login

# 마이그레이션 실행
supabase db push
```

### 4.3. Auth 설정

Supabase Dashboard > Authentication > Settings:
- Site URL: `http://localhost:5173`
- Redirect URLs: `http://localhost:5173/**`

## 5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

## 6. 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 유용한 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 (localhost:5173) |
| `npm run build` | 프로덕션 빌드 (Vite) |
| `npm run preview` | 빌드 미리보기 |
| `npm run lint` | ESLint 실행 |
| `npm run test` | Vitest 테스트 실행 |
| `npm run test:coverage` | 테스트 커버리지 |

## Edge Functions 개발

```bash
# Supabase CLI 로그인
supabase login

# Edge Functions 로컬 실행
supabase functions serve

# 개별 Edge Function 배포
supabase functions deploy accept-invite-v2 --no-verify-jwt

# 전체 Edge Function 배포
supabase functions deploy --no-verify-jwt

# 마이그레이션 적용
supabase db push
```

### Edge Functions 공유 모듈

모든 Edge Functions는 `supabase/functions/_shared/` 공유 모듈을 사용합니다:
- `cors.ts` - CORS 처리
- `env.ts` - 환경 변수
- `email.ts` - 이메일 발송 (Gmail + Resend)
- `response.ts` - 응답 헬퍼
- `supabase.ts` - Admin 클라이언트

## 프로젝트 구조

```
lilpm/
├── src/                # 프론트엔드 소스 코드
│   ├── components/     # 재사용 컴포넌트 (ui/, editor/, layout/)
│   ├── features/       # 기능 모듈 (issues/, lily/, prd/, projects/, team/)
│   ├── hooks/          # 커스텀 훅 (collaboration/, data/)
│   ├── lib/            # 서비스 + API 클라이언트
│   ├── pages/          # 페이지 컴포넌트 (auth/, settings/, onboarding/)
│   ├── stores/         # Zustand 전역 스토어
│   └── types/          # TypeScript 타입
├── supabase/           # Supabase 백엔드
│   ├── functions/      # Edge Functions (9개 + _shared/)
│   │   └── _shared/    # 공유 모듈 (CORS, email, env, response, supabase)
│   └── migrations/     # DB 마이그레이션
├── workers/            # Cloudflare Workers (Yjs 협업)
├── wiki/               # 프로젝트 위키 문서
└── package.json
```

## 트러블슈팅

### Supabase 연결 오류

```
Error: Invalid API key
```
→ `.env.local`의 `VITE_SUPABASE_ANON_KEY` 확인

### 빌드 실패

```
Type error: Cannot find module
```
→ `npm install` 재실행

### 포트 충돌

```bash
# 다른 포트로 실행
npm run dev -- --port 3000
```

---

**다음 단계**
- [컨트리뷰션 가이드](./contributing.md)
- [프론트엔드 아키텍처](../architecture/frontend.md)
