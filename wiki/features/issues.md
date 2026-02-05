# 🎫 이슈 관리

> 백로그에서 완료까지, 프로젝트 작업을 체계적으로 관리하세요.

## 개요

Lil PM의 이슈 관리 시스템은 Linear.app의 UX를 기반으로 설계되었습니다. 이슈 생성, 상태 관리, 필터링, 검색 등 모든 기능을 직관적인 UI로 제공합니다.

## 이슈 상태

| 상태 | 아이콘 | 설명 |
|------|--------|------|
| Backlog | 📋 | 아직 시작하지 않은 작업 |
| Todo | ⭕ | 곧 시작할 예정인 작업 |
| In Progress | 🔵 | 현재 진행 중인 작업 |
| Done | ✅ | 완료된 작업 |
| Canceled | ❌ | 취소된 작업 |

## 우선순위

| 우선순위 | 아이콘 | 설명 |
|----------|--------|------|
| Urgent | 🔴 | 즉시 처리 필요 |
| High | 🟠 | 우선 처리 |
| Medium | 🟡 | 일반적인 우선순위 |
| Low | 🟢 | 여유있게 처리 |
| No Priority | ⚪ | 우선순위 미지정 |

## 주요 기능

### 1. 이슈 생성
- **빠른 생성**: `Cmd/Ctrl + K` 또는 `+` 버튼
- **필수 항목**: 제목만 필수, 나머지는 선택
- **자동 할당**: 생성자에게 자동 담당자 지정 (설정 가능)

### 2. 이슈 뷰
- **리스트 뷰**: 기본 테이블 형태
- **보드 뷰**: 칸반 스타일
- **간트 차트**: 타임라인 뷰 ([자세히 보기](./gantt-chart.md))

### 3. 필터링
```
필터 조합 예시:
- 상태: In Progress + 담당자: 나 → 내 진행중인 이슈
- 우선순위: Urgent/High + 프로젝트: 특정 프로젝트 → 급한 이슈
```

### 4. 정렬
정렬 가능 필드:
- 생성일 (기본값)
- 수정일
- 우선순위
- 마감일
- 사용자 지정 순서 (드래그앤드롭)

### 5. 실시간 저장
- 모든 변경사항 자동 저장 (2초 디바운스)
- 저장 상태 표시: ☁️ 저장됨 / 🔄 저장중 / ⚠️ 미저장

## 이슈 상세

### 기본 정보
- **제목**: 이슈를 한줄로 설명
- **설명**: 마크다운/블록 에디터 지원
- **프로젝트**: 소속 프로젝트
- **사이클**: 소속 스프린트

### 메타데이터
- **담당자**: 작업 담당자 (복수 지정 가능)
- **상태**: 현재 진행 상태
- **우선순위**: 작업 우선순위
- **라벨**: 분류 태그

### 일정
- **시작일**: 작업 시작 예정일
- **마감일**: 작업 완료 기한

## 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Cmd/Ctrl + K` | 빠른 이슈 생성 |
| `Cmd/Ctrl + /` | 전역 검색 |
| `↑/↓` | 이슈 네비게이션 |
| `Enter` | 이슈 상세 열기 |
| `Esc` | 닫기/취소 |

## API 참조

### 서비스 함수

```typescript
// src/lib/services/issueService.ts

// 이슈 목록 조회
getIssues(teamId: string, filters?: IssueFilters): Promise<Issue[]>

// 이슈 생성
createIssue(teamId: string, issue: CreateIssueInput): Promise<Issue>

// 이슈 수정
updateIssue(issueId: string, updates: Partial<Issue>): Promise<Issue>

// 이슈 삭제
deleteIssue(issueId: string): Promise<void>
```

### 스토어

```typescript
// src/stores/issueStore.ts
interface IssueStore {
  issues: Issue[];
  isLoading: boolean;
  loadIssues(teamId: string): Promise<void>;
  createIssue(teamId: string, issue: CreateIssueInput): Promise<Issue>;
  updateIssue(issueId: string, updates: Partial<Issue>): Promise<void>;
}
```

---

**관련 문서**
- [간트 차트](./gantt-chart.md)
- [Lily AI](./lily-ai.md)
- [사이클](./cycles.md)
