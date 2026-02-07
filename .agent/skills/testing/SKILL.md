---
name: Testing Strategy
description: 기능 테스트, 모듈 테스트, E2E 테스트 가이드 (브라우저 최소화)
---

# Testing Strategy Skill

## 원칙
1. **브라우저 테스트 최소화** - 꼭 필요한 경우만 사용
2. **빠른 피드백** - 단위 테스트 우선
3. **높은 커버리지** - 핵심 로직 100% 테스트

## 테스트 유형별 우선순위

### 1. 단위 테스트 (최우선)
```typescript
// utils 함수 테스트
describe('formatDate', () => {
  it('should format date correctly', () => {
    expect(formatDate(new Date('2025-01-01'))).toBe('Jan 1, 2025');
  });
});
```

### 2. 서비스 레이어 테스트
```typescript
// API 호출 모킹
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: mockData })
    })
  }
}));
```

### 3. 컴포넌트 테스트
```typescript
import { render, screen } from '@testing-library/react';

it('renders button with correct text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

### 4. E2E 테스트 (브라우저 필요시만)
**사용자 확인 필요!** 브라우저 테스트 전 반드시 사용자에게 물어볼 것.

```typescript
// Playwright 예시
test('login flow', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
});
```

## 브라우저 테스트 피하는 방법

### API 응답 검증
```bash
# curl로 직접 테스트
curl -X POST https://api.example.com/endpoint \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"key": "value"}'
```

### React Testing Library
```typescript
// 실제 브라우저 없이 컴포넌트 동작 테스트
import { fireEvent, render } from '@testing-library/react';

it('handles click event', () => {
  const handleClick = vi.fn();
  render(<Button onClick={handleClick}>Submit</Button>);
  fireEvent.click(screen.getByText('Submit'));
  expect(handleClick).toHaveBeenCalled();
});
```

## 브라우저 테스트가 필요한 경우
- 복잡한 드래그&드롭 인터랙션
- Canvas/SVG 렌더링 검증
- 스크린샷 비교 테스트
- 실제 네트워크 요청 시나리오

## 회귀 테스트 체크리스트
- [ ] 변경된 파일의 기존 테스트 통과 확인
- [ ] 관련 컴포넌트 렌더링 테스트
- [ ] 빌드 성공 확인 (`npm run build`)
- [ ] TypeScript 검증 (`npx tsc --noEmit`)
