# 🔄 사이클 (스프린트)

> 시간 기반 프로젝트 관리로 팀의 생산성을 높이세요.

## 개요

사이클은 Linear의 Cycle 개념을 구현한 것으로, 정해진 기간 동안의 작업을 계획하고 추적하는 스프린트 관리 기능입니다.

## 사이클 상태

| 상태 | 설명 |
|------|------|
| 🔜 **Upcoming** | 시작 예정 사이클 |
| ▶️ **Active** | 현재 진행 중인 사이클 |
| ✅ **Completed** | 완료된 사이클 |

## 주요 기능

### 1. 사이클 생성

```typescript
interface CreateCycleInput {
  name: string;          // 사이클 이름 (예: "Sprint 23")
  start_date: string;    // 시작일
  end_date: string;      // 종료일
  description?: string;  // 설명 (선택)
}
```

### 2. 이슈 할당

- 이슈를 사이클에 드래그앤드롭으로 할당
- 이슈 상세에서 사이클 선택
- 벌크 선택 후 일괄 할당

### 3. 진행률 추적

```
사이클: Sprint 23
진행률: ████████░░░░░░░░ 50%

상태별 분포:
- Backlog: 3개
- In Progress: 5개
- Done: 8개
```

### 4. 사이클 뷰

사이클별로 이슈를 그룹화하여 표시:
- 리스트 뷰: 사이클별 섹션
- 보드 뷰: 사이클 필터
- 간트 차트: 사이클 기간 표시

## 자동 사이클

일정 주기로 자동 사이클 생성 (설정 가능):

```typescript
// cycleService.ts
interface CycleSettings {
  auto_create: boolean;    // 자동 생성 활성화
  duration_weeks: number;  // 기간 (주 단위)
  start_day: number;       // 시작 요일 (0=일, 1=월...)
}
```

## API 참조

```typescript
// src/lib/services/cycleService.ts

// 사이클 목록
getCycles(teamId: string): Promise<Cycle[]>

// 현재 활성 사이클
getActiveCycle(teamId: string): Promise<Cycle | null>

// 사이클 생성
createCycle(teamId: string, cycle: CreateCycleInput): Promise<Cycle>

// 이슈를 사이클에 할당
assignIssueToCycle(issueId: string, cycleId: string): Promise<void>
```

## 모범 사례

1. **적절한 기간 설정**: 1-2주가 일반적
2. **명확한 목표**: 각 사이클에 달성 목표 설정
3. **정기적인 리뷰**: 사이클 종료 시 회고
4. **범위 조절**: 중간에 범위 추가/제거 최소화

---

**관련 문서**
- [이슈 관리](./issues.md)
- [간트 차트](./gantt-chart.md)
