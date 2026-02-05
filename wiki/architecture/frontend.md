# 🏗️ 프론트엔드 아키텍처

> React + TypeScript 기반 SPA 구조

## 기술 스택

| 카테고리 | 기술 |
|----------|------|
| **Framework** | React 18 |
| **Language** | TypeScript 5.5 |
| **Build** | Vite 5.4 |
| **Styling** | TailwindCSS + shadcn/ui |
| **State** | Zustand |
| **Server State** | TanStack Query |
| **Routing** | React Router DOM v6 |
| **Forms** | React Hook Form + Zod |
| **i18n** | i18next |

## 디렉토리 구조

```
src/
├── components/           # 재사용 컴포넌트
│   ├── ui/              # shadcn/ui 기본 컴포넌트
│   ├── editor/          # 블록 에디터
│   ├── issues/          # 이슈 관련 컴포넌트
│   ├── layout/          # 레이아웃 컴포넌트
│   ├── lily/            # Lily AI 컴포넌트
│   └── search/          # 검색 컴포넌트
│
├── hooks/               # 커스텀 훅
│   ├── useAutoSave.ts   # 자동 저장 훅
│   └── useAISettings.ts # AI 설정 훅
│
├── lib/                 # 유틸리티 및 서비스
│   ├── services/        # API 서비스 레이어
│   ├── supabase.ts      # Supabase 클라이언트
│   └── utils.ts         # 유틸리티 함수
│
├── pages/               # 페이지 컴포넌트
│   ├── auth/            # 인증 페이지
│   ├── onboarding/      # 온보딩 페이지
│   └── settings/        # 설정 페이지
│
├── stores/              # Zustand 스토어
│   ├── authStore.ts     # 인증 상태
│   ├── teamStore.ts     # 팀 상태
│   ├── issueStore.ts    # 이슈 상태
│   ├── lilyStore.ts     # Lily AI 상태
│   └── mcpStore.ts      # MCP 연결 상태
│
├── types/               # TypeScript 타입
│   └── index.ts         # 공통 타입 정의
│
├── App.tsx              # 라우팅 설정
└── main.tsx             # 엔트리 포인트
```

## 상태 관리

### Zustand 스토어 패턴

```typescript
// stores/exampleStore.ts
import { create } from 'zustand';

interface ExampleState {
  items: Item[];
  isLoading: boolean;
  loadItems: (teamId: string) => Promise<void>;
  addItem: (item: CreateItemInput) => Promise<void>;
}

export const useExampleStore = create<ExampleState>((set, get) => ({
  items: [],
  isLoading: false,
  
  loadItems: async (teamId) => {
    set({ isLoading: true });
    const items = await exampleService.getItems(teamId);
    set({ items, isLoading: false });
  },
  
  addItem: async (item) => {
    const created = await exampleService.createItem(item);
    set({ items: [...get().items, created] });
  },
}));
```

### 주요 스토어

| 스토어 | 용도 | 주요 상태 |
|--------|------|-----------|
| `authStore` | 인증 관리 | user, isAuthenticated, isEmailVerified |
| `teamStore` | 팀 관리 | teams, currentTeam, members |
| `issueStore` | 이슈 관리 | issues, filters, pagination |
| `lilyStore` | Lily AI | messages, conversations, suggestedIssues |

## 컴포넌트 패턴

### 1. 페이지 컴포넌트

```tsx
// pages/ExamplePage.tsx
export function ExamplePage() {
  const { t } = useTranslation();
  const { items, loadItems } = useExampleStore();
  
  useEffect(() => {
    loadItems(teamId);
  }, [teamId]);
  
  return (
    <AppLayout>
      <PageHeader title={t('example.title')} />
      <ItemList items={items} />
    </AppLayout>
  );
}
```

### 2. 합성 컴포넌트

```tsx
// components/Card/index.tsx
export const Card = {
  Root: CardRoot,
  Header: CardHeader,
  Content: CardContent,
  Footer: CardFooter,
};

// 사용
<Card.Root>
  <Card.Header>제목</Card.Header>
  <Card.Content>내용</Card.Content>
</Card.Root>
```

### 3. 커스텀 훅

```tsx
// hooks/useAutoSave.ts
export function useAutoSave({ onSave, delay = 1000 }) {
  const [isPending, setIsPending] = useState(false);
  
  const debouncedSave = useMemo(
    () => debounce(onSave, delay),
    [onSave, delay]
  );
  
  return { debouncedSave, isPending };
}
```

## 라우팅

```tsx
// App.tsx
<Routes>
  {/* 공개 라우트 */}
  <Route element={<AuthRoute />}>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
  </Route>
  
  {/* 인증 필요 라우트 */}
  <Route element={<ProtectedRoute />}>
    <Route path="/auth/verify-email" element={<EmailVerificationPage />} />
    
    <Route element={<OnboardingCheck />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/issues" element={<IssuesPage />} />
      <Route path="/lily" element={<LilyPage />} />
    </Route>
  </Route>
</Routes>
```

## 스타일링

### TailwindCSS + shadcn/ui

```tsx
// 기본 사용
<Button variant="default" size="sm">
  클릭
</Button>

// cn() 유틸리티로 조건부 클래스
<div className={cn(
  "p-4 rounded-lg",
  isActive && "bg-primary text-primary-foreground",
  isDisabled && "opacity-50 cursor-not-allowed"
)}>
  내용
</div>
```

### 다크 모드

```tsx
// ThemeProvider로 테마 관리
<ThemeProvider defaultTheme="system" storageKey="lilpm-theme">
  <App />
</ThemeProvider>
```

---

**관련 문서**
- [데이터베이스 스키마](./database.md)
- [API 설계](./api.md)
