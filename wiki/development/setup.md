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
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 미리보기 |
| `npm run lint` | ESLint 실행 |
| `npm run type-check` | TypeScript 타입 체크 |

## 프로젝트 구조

```
lilpm/
├── src/                # 소스 코드
├── public/             # 정적 파일
├── supabase/           # Supabase 설정
│   ├── functions/      # Edge Functions
│   └── migrations/     # DB 마이그레이션
├── wiki/               # 문서
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
