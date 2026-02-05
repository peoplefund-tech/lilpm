# 👥 컨트리뷰션 가이드

> LilPM 프로젝트 기여 방법

## 개발 워크플로우

### 1. 이슈 확인

기여하기 전 관련 이슈가 있는지 확인:
- [Issues](https://github.com/jaehwapfct/lilpm/issues) 탭에서 검색
- 없으면 새 이슈 생성

### 2. 브랜치 생성

```bash
# develop 브랜치 기준
git checkout develop
git pull origin develop

# 기능 브랜치 생성
git checkout -b feature/이슈번호-간단한설명
# 예: feature/123-add-dark-mode
```

### 3. 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 사용:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type:**
- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 스타일 (포맷팅 등)
- `refactor`: 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드, 의존성 등

**예시:**
```bash
git commit -m "feat(gantt): add row drag-and-drop reordering

- Implement mouse-based drag system
- Add visual drop indicators
- Persist sort order to database

Closes #123"
```

### 4. Pull Request

1. 변경사항 푸시
   ```bash
   git push origin feature/123-add-dark-mode
   ```
2. GitHub에서 PR 생성
3. 템플릿에 맞게 설명 작성

## 코드 스타일

### TypeScript

```typescript
// 함수형 컴포넌트 사용
export function MyComponent({ title }: MyComponentProps) {
  return <div>{title}</div>;
}

// Props 인터페이스 분리
interface MyComponentProps {
  title: string;
  onClick?: () => void;
}

// 명시적 타입 선호
const items: Item[] = [];
const user: User | null = null;
```

### React

```tsx
// 훅 순서: useState → useRef → useEffect → 커스텀훅

function MyComponent() {
  // 상태
  const [value, setValue] = useState('');
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Effects
  useEffect(() => {
    // ...
  }, []);
  
  // 커스텀 훅
  const { data } = useMyHook();
  
  // 핸들러
  const handleClick = () => { ... };
  
  // 렌더
  return <div>...</div>;
}
```

### CSS (TailwindCSS)

```tsx
// cn() 유틸리티 사용
<div className={cn(
  "base-classes",
  condition && "conditional-classes"
)}>

// 긴 클래스는 줄바꿈
<button
  className={cn(
    "px-4 py-2 rounded-lg",
    "bg-primary text-primary-foreground",
    "hover:bg-primary/90 transition-colors",
    isDisabled && "opacity-50 cursor-not-allowed"
  )}
>
```

## 파일 명명 규칙

| 유형 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase | `IssueCard.tsx` |
| 훅 | camelCase + use | `useAutoSave.ts` |
| 서비스 | camelCase + Service | `issueService.ts` |
| 스토어 | camelCase + Store | `issueStore.ts` |
| 유틸리티 | camelCase | `utils.ts` |
| 타입 | camelCase 또는 PascalCase | `types.ts`, `Issue.ts` |

## 테스트

```bash
# 테스트 실행
npm run test

# 커버리지 확인
npm run test:coverage
```

## 리뷰 체크리스트

PR 제출 전 확인:

- [ ] 빌드 성공 (`npm run build`)
- [ ] 타입 에러 없음 (`npm run type-check`)
- [ ] 린트 통과 (`npm run lint`)
- [ ] 관련 문서 업데이트
- [ ] 커밋 메시지 컨벤션 준수

## 질문 및 지원

- GitHub Issues에 질문 등록
- 긴급한 문의: 메인테이너에게 직접 연락

---

**감사합니다! 🙏**
