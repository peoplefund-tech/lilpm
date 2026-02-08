# PRD 실시간 협업 (Real-time Collaboration)

## 개요

PRD 에디터에서 여러 사용자가 동시에 문서를 편집할 때, 각 사용자의 변경사항이 실시간으로 다른 사용자에게 반영되는 기능입니다.

## 아키텍처

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   브라우저 A    │◄────►│  Supabase        │◄────►│   브라우저 B    │
│   (편집 중)     │      │  Realtime        │      │   (읽기/편집)   │
│                 │      │  (Broadcast)     │      │                 │
│ ┌─────────────┐ │      └──────────────────┘      │ ┌─────────────┐ │
│ │ BlockEditor │ │                                │ │ BlockEditor │ │
│ │  (Tiptap)   │ │                                │ │  (Tiptap)   │ │
│ └─────────────┘ │                                │ └─────────────┘ │
│ ┌─────────────┐ │                                │ ┌─────────────┐ │
│ │ useSupabase │ │                                │ │ useSupabase │ │
│ │Collaboration│ │                                │ │Collaboration│ │
│ └─────────────┘ │                                │ └─────────────┘ │
└─────────────────┘                                └─────────────────┘
```

## 핵심 컴포넌트

### 1. useSupabaseCollaboration Hook

**위치**: `src/hooks/collaboration/useSupabaseCollaboration.ts`

Supabase Realtime을 사용하여 협업 기능을 제공하는 핵심 훅입니다.

#### 주요 기능

| 기능 | 설명 |
|------|------|
| `isConnected` | 실시간 채널 연결 상태 |
| `presenceUsers` | 현재 문서를 보고 있는 사용자 목록 |
| `updateCursorPosition` | 커서 위치를 다른 사용자에게 브로드캐스트 |
| `broadcastContentChange` | 컨텐츠 변경을 다른 사용자에게 브로드캐스트 |
| `onRemoteContentChange` | 원격 컨텐츠 변경 수신 콜백 등록 |

#### 채널 구조

```typescript
// Room name format
const roomName = `collab:prd:${documentId}`

// Supabase channel with presence
const channel = supabase.channel(roomName, {
  config: { presence: { key: userId } }
});
```

#### 이벤트 타입

1. **Presence Events**
   - `sync`: 현재 접속자 목록 동기화
   - `join`: 새 사용자 입장
   - `leave`: 사용자 퇴장

2. **Broadcast Events**
   - `content_change`: 컨텐츠 변경 (HTML 전문 전송)
   - `cursor_update`: 커서 위치 변경 (presence로 처리)

---

### 2. PRDDetailPage

**위치**: `src/pages/PRDDetailPage.tsx`

#### 컨텐츠 브로드캐스트 (송신)

```typescript
const handleContentChange = (value: string) => {
  setContent(value);
  
  // 다른 사용자에게 브로드캐스트
  if (isSupabaseCollabConnected) {
    broadcastContentChange(value);
  }
};
```

#### 원격 컨텐츠 수신

```typescript
useEffect(() => {
  if (isSupabaseCollabConnected) {
    onRemoteContentChange((remoteContent: string, remoteUserId: string) => {
      setContent(remoteContent);      // React 상태 업데이트
      setSavedContent(remoteContent); // 저장 상태 동기화
    });
  }
}, [isSupabaseCollabConnected, onRemoteContentChange]);
```

---

### 3. BlockEditor (Tiptap)

**위치**: `src/components/editor/BlockEditor.tsx`

#### 외부 컨텐츠 동기화

Tiptap의 `useEditor`는 `content` prop을 **초기화 시에만** 사용합니다.
원격 컨텐츠를 반영하려면 별도의 `useEffect`가 필요합니다:

```typescript
// Ref to track content changes
const lastContentRef = useRef(content);

// Sync editor with external content changes
useEffect(() => {
  if (!editor || !content) return;
  if (yjsDoc) return; // Yjs handles sync internally
  
  const currentEditorContent = editor.getHTML();
  
  // Only update if content changed externally
  if (content !== lastContentRef.current && content !== currentEditorContent) {
    // Save cursor position
    const { from, to } = editor.state.selection;
    
    // Update editor content
    editor.commands.setContent(content, { emitUpdate: false });
    
    // Restore cursor position
    try {
      const docSize = editor.state.doc.content.size;
      editor.commands.setTextSelection({
        from: Math.min(from, docSize),
        to: Math.min(to, docSize)
      });
    } catch {
      // If cursor position is invalid, ignore
    }
  }
  
  lastContentRef.current = content;
}, [editor, content, yjsDoc]);
```

> **중요**: `emitUpdate: false` 옵션은 `setContent` 호출 시 `onChange` 이벤트가 다시 발생하는 것을 방지합니다.

---

### 4. CursorOverlay

**위치**: `src/components/editor/CursorOverlay.tsx`

다른 사용자의 커서 위치를 시각적으로 표시합니다.

---

## 데이터 흐름

### 컨텐츠 편집 플로우

```
사용자 A 타이핑
     │
     ▼
BlockEditor.onUpdate
     │
     ▼
handleContentChange(value)
     │
     ├──► setContent(value)           ← React 상태 업데이트
     │
     └──► broadcastContentChange(value) ← Supabase Realtime 브로드캐스트
                    │
                    ▼
          Supabase Realtime Channel
                    │
                    ▼
           사용자 B의 channel.on('broadcast')
                    │
                    ▼
           contentChangeCallbackRef.current(content, userId)
                    │
                    ▼
           PRDDetailPage.onRemoteContentChange
                    │
                    ├──► setContent(remoteContent)  ← React 상태 업데이트
                    │
                    └──► BlockEditor.useEffect    ← 에디터 UI 업데이트
                              │
                              ▼
                    editor.commands.setContent(content)
```

---

## 자동 저장 & Overview 동기화

### 문제

PRD 목록 페이지에서는 `overview` 필드를 미리보기로 표시하지만, 에디터는 `content` 필드에만 저장했습니다. 이로 인해 목록의 미리보기가 실제 내용과 불일치했습니다.

### 해결

자동 저장 시 `content`와 `overview`를 동시에 업데이트:

```typescript
// extractOverview: HTML에서 plain text 미리보기 추출
const extractOverview = (htmlContent: string): string => {
  const temp = document.createElement('div');
  temp.innerHTML = htmlContent;
  const text = temp.textContent || temp.innerText || '';
  const preview = text.trim().replace(/\s+/g, ' ').slice(0, 200);
  return preview.length >= 200 ? preview + '...' : preview;
};

// 자동 저장
useAutoSave({
  value: content,
  onSave: async (value) => {
    await prdService.updatePRD(prdId, {
      content: value,
      overview: extractOverview(value)  // 동시 업데이트
    });
  },
  delay: 1500
});
```

---

## 제한사항 & 알려진 이슈

1. **Yjs 비활성화**: 현재 Yjs(CRDT) 기반 협업은 비활성화되어 있습니다 (`enabled: false`). Cloudflare Worker 배포 후 활성화 예정.

2. **동시 편집 충돌**: Yjs 없이는 두 사용자가 동시에 같은 위치를 편집할 때 마지막 저장이 우선됩니다 (Last-Writer-Wins).

3. **커서 위치 정확도**: 원격 컨텐츠 업데이트 후 로컬 커서 위치가 약간 어긋날 수 있습니다.

---

## 향후 개선 사항

1. **Yjs 활성화**: CRDT 기반 충돌 해결로 동시 편집 안정성 향상
2. **Operational Transform**: 대안적 충돌 해결 방식
3. **오프라인 지원**: IndexedDB 기반 로컬 캐싱
4. **변경 이력**: 실시간 undo/redo 동기화

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/hooks/collaboration/useSupabaseCollaboration.ts` | Supabase Realtime 훅 |
| `src/pages/PRDDetailPage.tsx` | PRD 편집 페이지 |
| `src/components/editor/BlockEditor.tsx` | Tiptap 에디터 래퍼 |
| `src/components/editor/CursorOverlay.tsx` | 원격 커서 표시 |
| `src/services/prdService.ts` | PRD CRUD API |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-02-08 | 실시간 컨텐츠 동기화 구현 완료 |
| 2026-02-08 | BlockEditor useEffect 추가로 원격 컨텐츠 UI 반영 |
| 2026-02-08 | overview 필드 자동 동기화 구현 |
