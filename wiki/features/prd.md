# 📝 PRD (제품 요구사항 문서)

> 체계적인 제품 기획 문서를 작성하고 관리하세요.

## 개요

PRD(Product Requirements Document)는 제품 또는 기능의 요구사항을 정의하는 문서입니다. LilPM에서는 Lily AI의 도움을 받아 대화에서 자동으로 PRD를 생성할 수 있습니다.

## PRD 상태

| 상태 | 설명 |
|------|------|
| 📝 **Draft** | 작성 중인 문서 |
| 👀 **In Review** | 리뷰 대기 중 |
| ✅ **Approved** | 승인된 문서 |
| 📦 **Archived** | 보관된 문서 |

## 주요 기능

### 1. 블록 에디터

TipTap 기반의 블록 에디터:
- **제목**: H1, H2, H3
- **리스트**: 순서 있음/없음, 체크리스트
- **테이블**: 표 삽입 및 편집
- **코드**: 코드 블록, 인라인 코드
- **미디어**: 이미지, 링크

### 2. 실시간 저장

모든 변경사항이 자동으로 저장됩니다:

```typescript
// useAutoSave 훅 사용
const { debouncedSave } = useAutoSave({
  onSave: async (value) => {
    await prdService.updatePRD(prdId, { content: value });
    setLastSaved(new Date());
  },
  delay: 2000, // 2초 디바운스
});
```

저장 상태 표시:
- ☁️ 모든 변경사항 저장됨
- 🔄 저장 중...
- ⚠️ 미저장 변경사항

### 3. AI 어시스턴트

PRD 편집 중 AI 패널을 열어 도움을 받을 수 있습니다:

```
사용자: 사용자 스토리 섹션을 더 구체적으로 작성해줘
Lily: [PRD_EDIT]
      {
        "description": "사용자 스토리 섹션 구체화",
        "newContent": "..."
      }
      [/PRD_EDIT]
      
      사용자 스토리 섹션을 업데이트했습니다.
      [수락] [거절]
```

### 4. 버전 히스토리

- AI 수정 사항 Undo/Redo 지원
- 수정 설명과 함께 버전 관리

## PRD 템플릿

기본 PRD 템플릿 구조:

```markdown
## 개요
프로젝트/기능에 대한 간단한 설명

## 목표
- [ ] 목표 1
- [ ] 목표 2

## 사용자 스토리
**As a** [사용자 유형], **I want to** [행동], **so that** [이유].

## 요구사항
### 기능 요구사항
- 요구사항 1
- 요구사항 2

### 비기능 요구사항
- 성능: ...
- 보안: ...

## 기술 명세
아키텍처 결정 및 구현 세부사항

## 타임라인 & 마일스톤
| 단계 | 설명 | 기간 |
|------|------|------|
| Phase 1 | 초기 개발 | 2주 |

## 성공 지표
- 지표 1: ...
- 지표 2: ...

## 미결 사항
- [ ] 확인이 필요한 사항
```

## API 참조

### 서비스 함수

```typescript
// src/lib/services/prdService.ts

// PRD 목록 조회
getPRDs(teamId: string): Promise<PRD[]>

// PRD 상세 조회
getPRD(prdId: string): Promise<PRDWithRelations>

// PRD 생성
createPRD(teamId: string, prd: CreatePRDInput): Promise<PRD>

// PRD 수정
updatePRD(prdId: string, updates: Partial<PRD>): Promise<PRD>

// 상태 변경
updateStatus(prdId: string, status: PRDStatus): Promise<void>
```

---

**관련 문서**
- [Lily AI](./lily-ai.md)
- [이슈 관리](./issues.md)
