# Lil PM - AI 기반 프로젝트 관리 플랫폼

> **Linear.app 클론** + **Lily AI** 를 활용한 차세대 프로젝트 관리 도구

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase)](https://supabase.io/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite)](https://vitejs.dev/)

## 문서 목차

### 기능 가이드
- [이슈 관리](./features/issues.md) - 이슈 생성, 상태 관리, 뷰 (리스트/보드/간트/캘린더/타임라인/갤러리/차트), 아카이브
- [간트 차트](./features/gantt-chart.md) - 타임라인 뷰, 어사이니 필터, 의존성 연결
- [Lily AI](./features/lily-ai.md) - AI 어시스턴트, PRD/티켓 생성, Canvas 모드, MCP 통합
- [PRD](./features/prd.md) - 블록 에디터, @멘션, 프로젝트 연결, 버전 히스토리
- [프로젝트](./features/projects.md) - 프로젝트 관리, 탭 저장, AI 연동
- [프로젝트 멤버](./features/project-members.md) - 프로젝트별 접근 권한 제어, RLS 기반 보안
- [사이클](./features/cycles.md) - 스프린트 관리
- [인증](./features/authentication.md) - 이메일 인증, 온보딩 플로우
- [팀 멤버 관리](./features/team-members.md) - 초대 수락/거절 UI, Edge Functions
- [팀 초대 플로우](./features/team-invite-flow.md) - accept-invite-v2 상세 플로우
- [대시보드](./features/dashboard.md) - 위젯 기반 대시보드
- [Database](./features/database.md) - Notion 스타일 데이터베이스 (7가지 뷰)
- [블록 에디터](./features/block-editor.md) - TipTap 기반 에디터, 확장 기능
- [알림](./features/notifications.md) - 인박스 + 이메일 알림
- [검색](./features/search.md) - 글로벌 검색
- [아카이브](./features/archive.md) - 이슈/PRD 보관 시스템
- [설정](./features/settings.md) - AI, MCP, LLM, GitHub, Slack, 보안 설정
- [온보딩](./features/onboarding.md) - 신규 유저 온보딩 플로우
- [MCP 통합](./features/mcp.md) - Model Context Protocol 프록시
- [실시간 협업](./features/realtime-collaboration.md) - Supabase Realtime, Yjs, Cloudflare Workers

### 아키텍처
- [프론트엔드 구조](./architecture/frontend.md) - React 18, feature 모듈, 라우팅
- [데이터베이스 스키마](./architecture/database.md) - 30+ 테이블, RPC 함수, RLS 정책
- [API 설계](./architecture/api.md) - Supabase Client + 9개 Edge Functions
- [Zustand 스토어](./architecture/stores.md) - 10개 전역 상태 관리
- [서비스 레이어](./architecture/services.md) - 비즈니스 로직 캡슐화
- [협업 아키텍처](./architecture/collaboration.md) - Supabase Realtime + Yjs + Cloudflare Workers
- [마이그레이션](./architecture/migrations.md) - 32+ 마이그레이션, FK 규칙
- [성능 최적화](./architecture/performance.md) - 코드 스플리팅, 번들 최적화, React Query, 컴포넌트 최적화
- [배포](./architecture/deployment.md) - Vercel + Supabase + Cloudflare Workers

### 리팩토링 & 마이그레이션
- [2026-02-10 리팩토링 리포트](./REFACTORING-2026-02-10.md) - Edge Functions, DB 인덱스, 프론트엔드 최적화 전체 상세

### 개발 가이드
- [환경 설정](./development/setup.md)
- [컨트리뷰션 가이드](./development/contributing.md)

---

## 빠른 시작

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

## 주요 기능

| 기능 | 설명 |
|------|------|
| **이슈 관리** | 7가지 뷰 (리스트, 보드, 간트, 캘린더, 타임라인, 갤러리, 차트), 아카이브, 서브이슈, 템플릿 |
| **간트 차트** | 드래그앤드롭 일정 조정, Jira 스타일 어사이니 필터, 의존성 연결 |
| **Lily AI** | PRD/티켓 자동 생성, Canvas 모드, MCP 통합, 멀티 모델 (Claude/GPT-4o/Gemini) |
| **PRD** | 블록 에디터, @멘션 알림, 프로젝트 다중 연결, 버전 히스토리 |
| **Database** | Notion 스타일 DB - 7가지 뷰 (Table/Board/Calendar/Gallery/Timeline/Chart/Form) |
| **사이클** | 스프린트 기반 프로젝트 관리, 번다운 차트 |
| **팀 협업** | 초대 수락/거절 UI, 프로젝트별 멤버 할당, 실시간 동기화 |
| **실시간 협업** | Supabase Realtime + Yjs + Cloudflare Workers, 커서 프레즌스 |
| **프로젝트 멤버** | 프로젝트별 접근 권한 제어, RLS 기반 보안 |
| **대시보드** | AI 히어로 카드, 이슈 통계, 주간 활동 차트, 빠른 액션 |
| **알림** | 인박스 + 이메일 알림 (7가지 유형), Toast 알림 |
| **검색** | 글로벌 검색 (이슈, PRD, 프로젝트, 멤버) |
| **아카이브** | 이슈/PRD 보관, 30일 자동 삭제, 복원 |
| **프로필** | 활동 차트, 기여 통계, 활동 히스토리 |
| **설정** | AI, MCP, LLM, GitHub, Slack, 보안, 알림 설정 |
| **다국어** | 영어/한국어 (i18next) |

## 기술 스택

### 프론트엔드
- **React 18** + TypeScript 5.5
- **Vite 5.4** - 빌드 도구
- **TailwindCSS 3.4** + shadcn/ui (Radix UI) - 스타일링
- **Zustand 5.0** - 전역 상태 관리
- **TanStack Query 5.83** - 서버 상태 관리
- **React Router DOM 6.30** - 라우팅
- **TipTap 3.19** - 블록 에디터
- **Yjs 13.6** - CRDT 협업 편집
- **Liveblocks** - 실시간 협업
- **i18next** - 다국어 (영어/한국어)
- **React Hook Form + Zod** - 폼 검증
- **Recharts** - 차트
- **@dnd-kit** - 드래그앤드롭

### 백엔드
- **Supabase** - PostgreSQL + Auth + Realtime + Edge Functions
- **Cloudflare Workers** - Yjs 협업 서버 (Durable Objects)
- **PartyKit** - 실시간 협업 대안

### AI
- **Claude (Anthropic)** - 기본 AI 모델 (claude-sonnet-4-20250514)
- **GPT-4o (OpenAI)** - 대체 모델
- **Gemini (Google)** - 대체 모델
- **Lovable Gateway** - 폴백 게이트웨이

### Edge Functions (9개)
| 함수 | 용도 | JWT |
|------|------|:---:|
| `accept-invite-v2` | 초대 수락 (인증/매직링크/회원가입) | No |
| `delete-users` | 유저 완전 삭제 (Admin) | No |
| `get-invite-preview` | 초대 미리보기 (RLS 우회) | No |
| `lily-chat` | AI 채팅 프록시 (스트리밍) | No |
| `mcp-proxy` | MCP 서버 프록시 | No |
| `send-member-removed` | 멤버 제거 이메일 | No |
| `send-mention-email` | @멘션 이메일 | No |
| `send-notification-email` | 7가지 알림 이메일 | No |
| `send-team-invite` | 팀 초대 이메일 | No |

> 참고: `config.toml`에서 모든 Edge Function의 `verify_jwt = false`로 설정되어 있음

### 배포
- **Vercel** - 프론트엔드 호스팅
- **Supabase** - 백엔드 (Edge Functions 포함)
- **Cloudflare Workers** - 협업 서버

## 프로젝트 구조

```
LilPM/
├── src/                         # 프론트엔드 소스 코드
│   ├── App.tsx                  # 라우팅 설정 (40+ 라우트)
│   ├── main.tsx                 # 엔트리 포인트
│   ├── i18n.ts                  # i18n 설정
│   │
│   ├── components/              # 재사용 컴포넌트
│   │   ├── ui/                  # shadcn/ui 컴포넌트 (111+ 파일)
│   │   │   ├── advanced/        # 고급 (calendar, carousel, chart, command)
│   │   │   ├── display/         # 표시 (avatar, badge, card, progress)
│   │   │   ├── feedback/        # 피드백 (alert, toast, sonner)
│   │   │   ├── forms/           # 폼 (button, input, select, checkbox)
│   │   │   ├── layout/          # 레이아웃 (accordion, resizable, sidebar)
│   │   │   ├── navigation/      # 네비게이션 (tabs, breadcrumb, dropdown)
│   │   │   └── overlay/         # 오버레이 (dialog, sheet, popover)
│   │   ├── editor/              # TipTap 블록 에디터
│   │   │   ├── extensions/      # 에디터 확장 (blocks, database, interactive, layout, media)
│   │   │   ├── BlockEditor/     # 블록 에디터 코어
│   │   │   └── ...              # 커서, 댓글, 버전 히스토리 등
│   │   ├── collaboration/       # 실시간 협업 UI (Presence, Cursors)
│   │   ├── cycles/              # 사이클 (BurndownChart, CycleIssueModal)
│   │   ├── dashboard/           # 대시보드 위젯 (10+ 카드)
│   │   ├── layout/              # 앱 레이아웃 (AppLayout, Sidebar, Header)
│   │   ├── lily/                # Lily AI 컴포넌트
│   │   ├── notifications/       # 알림 드롭다운
│   │   ├── prd/                 # PRD 컴포넌트
│   │   ├── profile/             # 프로필 (활동 차트, 통계)
│   │   ├── projects/            # 프로젝트 컴포넌트
│   │   ├── search/              # 글로벌 검색
│   │   ├── shortcuts/           # 키보드 단축키 도움말
│   │   ├── team/                # 팀 컴포넌트
│   │   └── landing/             # 랜딩 페이지
│   │
│   ├── features/                # 기능 모듈 (Feature-based architecture)
│   │   ├── issues/              # 이슈 관리
│   │   │   ├── components/      # GanttChart, IssueCard, IssueList, kanban
│   │   │   ├── pages/           # IssuesPage, IssueDetailPage, MyIssuesPage, ArchivePage
│   │   │   ├── services/        # issueService, commentService, dependencyService
│   │   │   ├── adapters/        # DatabaseAdapter (DB뷰 연동)
│   │   │   └── store.ts         # Zustand 이슈 스토어
│   │   ├── lily/                # Lily AI
│   │   │   ├── api/             # lilyApi (Edge Function 통신)
│   │   │   ├── components/      # LilyChat, 채팅 UI
│   │   │   ├── pages/           # LilyPage
│   │   │   ├── store.ts         # AI 대화 스토어
│   │   │   └── utils/           # chatStream, mcpUtils
│   │   ├── prd/                 # PRD 관리
│   │   │   ├── pages/           # PRDPage, PRDDetailPage
│   │   │   ├── services/        # prdService, prdVersionService
│   │   │   └── types/           # PRDTypes
│   │   ├── projects/            # 프로젝트 관리
│   │   │   ├── components/      # ProjectCard, ProjectStatsCard, Modals
│   │   │   ├── pages/           # ProjectsPage, ProjectDetailPage
│   │   │   └── services/        # projectService, projectMemberService
│   │   └── team/                # 팀 관리
│   │       ├── components/      # ProjectAssignmentModal
│   │       └── pages/           # TeamMembersPage, TeamSettingsPage
│   │
│   ├── hooks/                   # 커스텀 훅
│   │   ├── collaboration/       # useSupabaseCollaboration, useCloudflareCollaboration
│   │   ├── data/                # useAISettings, useAutoSave, useTeamRealtime
│   │   ├── ui/                  # UI 관련 훅
│   │   └── ...                  # useKeyboardShortcuts, useOfflineSync, usePageHistory
│   │
│   ├── lib/                     # 유틸리티 및 서비스
│   │   ├── api/                 # API 클라이언트 (authApi, issueApi, teamApi, projectApi)
│   │   ├── collaboration/       # 협업 유틸리티
│   │   ├── services/            # 비즈니스 서비스
│   │   │   ├── team/            # teamService, teamMemberService, teamInviteService, profileService
│   │   │   ├── activityService.ts
│   │   │   ├── blockCommentService.ts
│   │   │   ├── conversationService.ts
│   │   │   ├── cycleService.ts
│   │   │   └── notificationService.ts
│   │   ├── supabase.ts          # Supabase 클라이언트
│   │   └── utils.ts             # 유틸리티 함수
│   │
│   ├── pages/                   # 페이지 컴포넌트
│   │   ├── auth/                # 인증 (Login, Signup, AcceptInvite, etc.)
│   │   ├── onboarding/          # 온보딩 (CreateTeam, CreateProject, AISetup)
│   │   ├── settings/            # 설정 (AI, MCP, LLM, GitHub, Slack, Security)
│   │   ├── hooks/               # Database 컴포넌트 (Notion-style DB 뷰)
│   │   ├── DashboardPage.tsx    # 대시보드
│   │   ├── DatabasePage.tsx     # Notion-style 데이터베이스
│   │   ├── CyclesPage.tsx       # 사이클 관리
│   │   ├── InboxPage.tsx        # 인박스 (알림)
│   │   └── ...
│   │
│   ├── stores/                  # Zustand 전역 스토어
│   │   ├── authStore.ts         # 인증 상태
│   │   ├── teamStore.ts         # 팀 + 프로젝트 관리
│   │   ├── collaborationStore.ts # 실시간 협업
│   │   ├── notificationStore.ts # 알림
│   │   ├── mcpStore.ts          # MCP 설정
│   │   ├── themeStore.ts        # 테마 (다크/라이트)
│   │   ├── languageStore.ts     # 언어 (en/ko)
│   │   ├── integrationStore.ts  # 외부 연동 (GitHub, Slack)
│   │   └── notificationSettingsStore.ts
│   │
│   ├── locales/                 # 다국어 번역
│   │   ├── en.json              # 영어
│   │   └── ko.json              # 한국어
│   │
│   ├── types/                   # TypeScript 타입
│   │   ├── index.ts             # 공통 타입
│   │   ├── database.ts          # DB 관련 타입
│   │   ├── integrations.ts      # 외부 연동 타입
│   │   └── mcp.ts               # MCP 타입
│   │
│   └── test/                    # 테스트 유틸리티
│
├── supabase/                    # Supabase 백엔드
│   ├── config.toml              # Edge Function 설정
│   ├── functions/               # Edge Functions (9개)
│   │   ├── _shared/             # 공유 모듈 (CORS, env, email, response, supabase)
│   │   ├── accept-invite-v2/    # 초대 수락 (인증/매직링크/회원가입)
│   │   ├── delete-users/        # 유저 완전 삭제
│   │   ├── get-invite-preview/  # 초대 미리보기
│   │   ├── lily-chat/           # AI 채팅 프록시
│   │   ├── mcp-proxy/           # MCP 서버 프록시
│   │   ├── send-member-removed/ # 멤버 제거 이메일
│   │   ├── send-mention-email/  # @멘션 이메일
│   │   ├── send-notification-email/ # 알림 이메일
│   │   └── send-team-invite/    # 팀 초대 이메일
│   ├── migrations/              # 활성 마이그레이션
│   └── migrations-archive/      # 아카이브된 마이그레이션 (32+)
│
├── workers/                     # Cloudflare Workers
│   └── collab/                  # Yjs 협업 서버
│       ├── src/
│       │   ├── index.ts         # Worker 엔트리
│       │   └── YjsRoom.ts      # Yjs Durable Object
│       └── wrangler.toml        # Cloudflare 설정
│
├── docs/                        # DB 문서
│   └── database/
│       ├── 001_schema.sql       # 스키마 정의
│       └── 002_rls_policies.sql # RLS 정책
│
├── wiki/                        # 프로젝트 위키 (이 문서)
├── party/                       # PartyKit 설정
├── scripts/                     # 유틸리티 스크립트
└── .agent/                      # AI 에이전트 스킬/워크플로우
```

## 환경 변수

```env
# Supabase (필수)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 사이트 URL (이메일 인증 리다이렉트용)
VITE_SITE_URL=http://localhost:5173

# Cloudflare Workers (실시간 협업용)
VITE_COLLAB_WORKER_URL=https://your-worker.workers.dev

# Liveblocks (선택)
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_...
```

## 최근 업데이트 (2026-02-10)

### 전체 스택 리팩토링 & 메이저 업그레이드
- **[상세 리팩토링 리포트](./REFACTORING-2026-02-10.md)** - Phase 1~4 전체 변경 사항
- **메이저 업그레이드** - Vite 5→7, React 18→19, Tailwind 3→4, TypeScript strict
- **Edge Functions 리팩토링** - `_shared/` 모듈로 중복 코드 제거 (~300줄 절감)
- **DB 성능 인덱스** - 16개 새 인덱스 (Composite, Partial, GIN)
- **프론트엔드 최적화** - Virtual Scrolling, React.memo, useCallback, React Query 10개 훅
- **빌드 성능** - 5.56s → 3.86s (-31%), react-vendor 162KB → 20KB (-87%)

### 초대 시스템 개선
- **프로젝트별 초대** - 초대 시 특정 프로젝트만 할당 가능 (`project_ids` 컬럼)
- **accept-invite-v2** - 인증/매직링크/회원가입 3가지 경로 처리
- **프로젝트 할당 정리** - 초대 수락 시 선택된 프로젝트만 남기고 나머지 제거

### Database 기능 확장
- **Sub-items** - `parent_id`, `position` 컬럼 추가
- **Rollup 설정** - `database_properties`에 rollup 설정 추가
- **블록 댓글 리액션** - `block_comment_reactions` 테이블 추가

### 이전 업데이트 (2026-02-08)
- 프로젝트 멤버 시스템 (RLS 기반 접근 제어)
- 팀 탈퇴 기능
- 초대 수락/거절 UI
- Database 기능 (Notion-style)
- 이메일 알림 시스템
- 블록 프레즌스 인디케이터

## 라이선스

MIT License

---

**더 자세한 내용은 각 문서 페이지를 참조하세요.**
