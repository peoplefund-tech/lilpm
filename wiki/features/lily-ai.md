# 🤖 Lily AI

> AI 어시스턴트와 대화하며 PRD와 티켓을 자동 생성하세요.

## 개요

Lily는 LilPM에 내장된 AI 어시스턴트입니다. 프로젝트 기획, PRD 작성, 개발 티켓 생성을 대화형 인터페이스로 지원합니다.

## 지원 AI 모델

| 모델 | 제공자 | 특징 |
|------|--------|------|
| 🟣 **Claude Sonnet** | Anthropic | 코드 분석, 복잡한 추론에 강점 |
| 🟢 **GPT-4o** | OpenAI | 범용 AI, 빠른 응답 |
| 🔵 **Gemini Pro** | Google | 멀티모달, 긴 컨텍스트 |

## 주요 기능

### 1. 대화형 기획

```
사용자: 사용자 인증 기능을 구현하고 싶어
Lily: 인증 기능에 대해 자세히 알려주세요. 
      - 소셜 로그인이 필요한가요?
      - 이메일 인증이 필요한가요?
      - 2FA를 지원할 건가요?
```

### 2. PRD 자동 생성

1. 대화를 통해 요구사항 정리
2. "PRD 생성하기" 버튼 클릭
3. AI가 구조화된 PRD 문서 생성
4. PRD 페이지에서 편집 및 저장

### 3. 티켓 자동 생성

```
Lily: 다음 티켓들을 제안드립니다:

[제안된 이슈]
1. 🎫 이메일 인증 API 구현
   우선순위: 높음
   [수락] [거절]

2. 🎫 로그인 페이지 UI 구현
   우선순위: 중간
   [수락] [거절]

[모두 수락]
```

### 4. Canvas 모드

실시간 코드 생성 및 미리보기:

```
┌─────────────────────┬─────────────────────┐
│      대화창          │     Canvas          │
├─────────────────────┼─────────────────────┤
│ 사용자: 로그인 폼    │ [코드] [미리보기]    │
│        만들어줘     │                     │
│                     │   ┌─────────────┐   │
│ Lily: 만들고        │   │ Login Form  │   │
│       있습니다...   │   │ ───────────│   │
│                     │   │ Email: ___  │   │
│                     │   │ Pass: ___   │   │
│                     │   │ [Login]     │   │
│                     │   └─────────────┘   │
└─────────────────────┴─────────────────────┘
```

## API 키 설정

### 설정 방법

1. **설정 페이지**: `/settings/ai` 에서 설정
2. **모달 입력**: Lily 최초 사용 시 모달에서 입력

### 저장 위치

API 키는 Supabase `user_settings` 테이블에 암호화되어 저장됩니다:

```sql
user_settings (
  user_id UUID,
  anthropic_api_key TEXT,
  openai_api_key TEXT,
  gemini_api_key TEXT,
  default_provider TEXT,
  auto_mode_enabled BOOLEAN
)
```

## 기술 구현

### 스트리밍 응답

Server-Sent Events (SSE)를 통한 실시간 스트리밍:

```typescript
// LilyChat.tsx
const response = await fetch('/functions/v1/lily-chat', {
  method: 'POST',
  body: JSON.stringify({ messages, provider, stream: true }),
});

const reader = response.body?.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  // 스트리밍 데이터 처리
}
```

### Thinking 블록

Claude의 사고 과정 표시:

```typescript
// <thinking> 태그 파싱
const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
if (thinkingMatch) {
  thinkingContent = thinkingMatch[1];
  cleanContent = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
}
```

### 추천 이슈

```typescript
// SuggestedIssuesList 컴포넌트
interface SuggestedIssue {
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

// 수락 시 실제 이슈로 생성
onAcceptIssue={(index, issue) => {
  await createIssue(teamId, issue);
  acceptSuggestedIssue(index);
}}
```

## 프롬프트 엔지니어링

### 시스템 프롬프트 구조

```
당신은 Lily, LilPM의 AI 제품 기획 어시스턴트입니다.

역할:
- 프로젝트 요구사항 분석
- PRD 문서 작성 지원
- 개발 티켓 생성 제안

응답 규칙:
1. 한국어로 응답 (사용자 언어에 맞춤)
2. 구조화된 형식 사용
3. 실행 가능한 티켓 제안

컨텍스트:
- 현재 프로젝트: {projectName}
- 팀: {teamName}
- 기존 이슈 수: {issueCount}
```

---

**관련 문서**
- [PRD](./prd.md)
- [이슈 관리](./issues.md)
- [API 설계](../architecture/api.md)
