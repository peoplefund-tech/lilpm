# 🎯 Lil PM - AI 기반 프로젝트 관리 플랫폼

> **Linear.app 클론** + **Lily AI** 를 활용한 차세대 프로젝트 관리 도구

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase)](https://supabase.io/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite)](https://vitejs.dev/)

## 📚 문서 목차

### 기능 가이드
- [이슈 관리](./features/issues.md) - 이슈 생성, 상태 관리, 필터링
- [간트 차트](./features/gantt-chart.md) - 타임라인 뷰, 드래그앤드롭
- [Lily AI](./features/lily-ai.md) - AI 어시스턴트, PRD/티켓 생성
- [PRD](./features/prd.md) - 제품 요구사항 문서 관리
- [사이클](./features/cycles.md) - 스프린트 관리
- [인증](./features/authentication.md) - 이메일 인증, 로그인

### 아키텍처
- [프론트엔드 구조](./architecture/frontend.md)
- [데이터베이스 스키마](./architecture/database.md)
- [API 설계](./architecture/api.md)

### 개발 가이드
- [환경 설정](./development/setup.md)
- [컨트리뷰션 가이드](./development/contributing.md)

---

## 🚀 빠른 시작

```bash
# 저장소 클론
git clone https://github.com/jaehwapfct/lilpm.git
cd lilpm

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일 편집하여 Supabase 키 입력

# 개발 서버 실행
npm run dev
```

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 🎫 **이슈 관리** | 백로그, 진행중, 완료 상태 관리 |
| 📊 **간트 차트** | 드래그앤드롭으로 일정 조정 |
| 🤖 **Lily AI** | PRD/티켓 자동 생성, 대화형 기획 |
| 📝 **PRD** | 제품 요구사항 문서 작성 및 실시간 저장 |
| 🔄 **사이클** | 스프린트 기반 프로젝트 관리 |
| 👥 **팀 협업** | 팀 생성, 멤버 초대 |

## 🛠️ 기술 스택

### 프론트엔드
- **React 18** + TypeScript
- **Vite** - 빌드 도구
- **TailwindCSS** + shadcn/ui - 스타일링
- **Zustand** - 상태 관리
- **TanStack Query** - 서버 상태 관리

### 백엔드
- **Supabase** - PostgreSQL + Auth + Storage
- **Edge Functions** - AI API 프록시

### AI
- **Claude (Anthropic)** - 기본 AI 모델
- **GPT-4o (OpenAI)** - 대체 모델
- **Gemini (Google)** - 대체 모델

## 📁 프로젝트 구조

```
src/
├── components/          # React 컴포넌트
│   ├── editor/         # 블록 에디터
│   ├── issues/         # 이슈 관련 (GanttChart, IssueCard 등)
│   ├── layout/         # 레이아웃 (Sidebar, AppLayout)
│   └── lily/           # Lily AI 관련
├── hooks/              # 커스텀 훅
├── lib/                # 유틸리티, 서비스
│   └── services/       # API 서비스
├── pages/              # 페이지 컴포넌트
│   ├── auth/           # 인증 페이지
│   ├── onboarding/     # 온보딩 페이지
│   └── settings/       # 설정 페이지
├── stores/             # Zustand 스토어
└── types/              # TypeScript 타입 정의
```

## 🔐 환경 변수

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SITE_URL=http://localhost:5173
```

## 📜 라이선스

MIT License

---

**💡 더 자세한 내용은 각 문서 페이지를 참조하세요.**
