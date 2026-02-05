# 📊 간트 차트

> 프로젝트 일정을 시각적으로 관리하세요.

## 개요

간트 차트는 이슈의 시작일과 마감일을 타임라인으로 표시합니다. 드래그앤드롭으로 일정을 조정하고, 의존성을 설정하여 작업 순서를 관리할 수 있습니다.

## 레이아웃

```
┌─────────────────┬──────────────────────────────────────────┐
│    사이드바      │              타임라인                     │
├─────────────────┼──────────────────────────────────────────┤
│ ▸ 이슈 1        │ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│ ▸ 이슈 2        │         ████████████░░░░░░░░░░░░░░░░░░░  │
│ ▸ 이슈 3        │                     ██████████████░░░░░  │
└─────────────────┴──────────────────────────────────────────┘
      ↑                           ↑
   행 드래그                   바 드래그
   (순서 변경)                (일정 변경)
```

## 주요 기능

### 1. 드래그앤드롭

| 드래그 대상 | 동작 |
|-------------|------|
| **바 중앙** | 시작일/마감일 함께 이동 |
| **바 왼쪽** | 시작일만 변경 |
| **바 오른쪽** | 마감일만 변경 |
| **사이드바 행** | 이슈 순서 변경 |

### 2. 의존성 연결

```
이슈 A ────────→ 이슈 B
      (차단)
```

- 바의 끝점에서 다른 바로 드래그하면 의존성 생성
- 의존성 삭제: 연결선 클릭 후 삭제

### 3. 그룹화

그룹화 옵션:
- **없음**: 모든 이슈 평면 표시
- **프로젝트별**: 프로젝트 그룹으로 정렬
- **상태별**: 상태 그룹으로 정렬
- **우선순위별**: 우선순위 그룹으로 정렬
- **담당자별**: 담당자 그룹으로 정렬

### 4. 줌 컨트롤

| 뷰 | 단위 | 용도 |
|----|------|------|
| 일 | 1일 | 상세 일정 확인 |
| 주 | 7일 | 일반적인 뷰 (기본값) |
| 월 | 30일 | 장기 일정 확인 |

## 기술 구현

### 드래그 시스템

LilPM 간트 차트는 **순수 마우스 이벤트** 기반 드래그 시스템을 사용합니다:

```typescript
// 상태 머신
type DragMode = 
  | 'none'           // 드래그 없음
  | 'pending-bar'    // 바 클릭 후 대기
  | 'pending-row'    // 행 클릭 후 대기
  | 'move'           // 바 이동 중
  | 'resize-start'   // 시작일 조정 중
  | 'resize-end'     // 마감일 조정 중  
  | 'row-reorder'    // 행 순서 변경 중
  | 'linking'        // 의존성 연결 중
```

### sortOrder 계산

행 순서는 `sortOrder` 필드로 관리됩니다:

```typescript
// 렌더 오더 기반 계산
const BASE_GAP = 1000;

// 드롭 시 새 sortOrder 계산
function calculateNewSortOrder(
  targetIndex: number,
  position: 'before' | 'after',
  effectiveOrderMap: Map<string, number>
): number {
  const lowerBound = targetIndex > 0 ? orderMap.get(items[targetIndex-1].id) : 0;
  const upperBound = targetIndex < items.length - 1 ? orderMap.get(items[targetIndex+1].id) : lowerBound + BASE_GAP * 2;
  return (lowerBound + upperBound) / 2;
}
```

### 의존성 렌더링

SVG 레이어에서 베지어 곡선으로 연결:

```typescript
// SVG 경로 계산
const path = `M ${startX} ${startY} 
              C ${startX + 50} ${startY}, 
                ${endX - 50} ${endY}, 
                ${endX} ${endY}`;
```

## 트러블슈팅

### 드래그 시 랜덤 점프 현상

**원인**: `sortOrder` 계산 시 렌더 순서와 정렬 순서 불일치

**해결**: 
```typescript
// ❌ 잘못된 방법 - 자연 정렬 사용
const sortedIssues = [...issues].sort(naturalSort);

// ✅ 올바른 방법 - 렌더 순서 사용
const effectiveOrderMap = new Map();
allIssues.forEach((issue, index) => {
  effectiveOrderMap.set(issue.id, issue.sortOrder ?? (index + 1) * BASE_GAP);
});
```

### 의존성 라인이 드래그 막음

**원인**: SVG 요소가 마우스 이벤트 가로채기

**해결**:
```tsx
<svg style={{ pointerEvents: dragMode !== 'none' ? 'none' : 'auto' }}>
  {/* 의존성 라인 */}
</svg>
```

---

**관련 문서**
- [이슈 관리](./issues.md)
- [프론트엔드 아키텍처](../architecture/frontend.md)
