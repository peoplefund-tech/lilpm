---
name: Performance Optimization
description: 빌드 최적화, 번들 분석, 코드 스플리팅, 캐싱 전략 가이드
---

# Performance Optimization Skill

## 사용 시나리오
- 빌드 시간/크기 최적화
- 페이지 로딩 속도 개선
- React 컴포넌트 성능 튜닝

## Code Splitting 패턴

### React.lazy() 사용
```typescript
// 페이지 레벨 lazy loading
const MyPage = React.lazy(() => 
  import("./pages/MyPage").then(m => ({ default: m.MyPage }))
);

// Suspense로 감싸기
<Suspense fallback={<Spinner />}>
  <MyPage />
</Suspense>
```

### manualChunks 설정
```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'supabase': ['@supabase/supabase-js'],
      }
    }
  }
}
```

## 번들 분석

### 크기 확인
```bash
npm run build
du -sh dist/assets/*.js | sort -h
```

### 목표 크기
| 청크 타입 | 목표 크기 (gzip) |
|----------|-----------------|
| index.js | < 100KB |
| vendor chunks | < 200KB each |
| page chunks | < 50KB each |

## 캐싱 전략

### In-Memory Cache
```typescript
const cache = new Map<string, { data: T, expiry: number }>();

function getCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>) {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }
  const data = await fetcher();
  cache.set(key, { data, expiry: Date.now() + ttlMs });
  return data;
}
```

### Stale-While-Revalidate
- 캐시된 데이터 즉시 반환
- 백그라운드에서 최신 데이터 fetch
- React Query나 SWR 사용 권장

## 체크리스트
- [ ] 무거운 페이지에 React.lazy() 적용
- [ ] vendor 라이브러리 별도 chunk로 분리
- [ ] 자주 접근하는 데이터 캐싱
- [ ] 빌드 후 번들 크기 확인
