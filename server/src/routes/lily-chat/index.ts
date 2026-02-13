/**
 * Lily Chat Routes -- /api/lily-chat
 *
 * Multi-provider AI chat with SSE streaming.
 * Ported from the Supabase Edge Function lily-chat.
 *
 * Endpoints:
 *   POST /  -- Main chat endpoint (SSE streaming or JSON)
 *   GET  /  -- Diagnostics / health check
 */

import type { FastifyPluginAsync } from 'fastify';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { userAiSettings } from '../../db/schema.js';
import { env } from '../../config/env.js';

// ─── Version ────────────────────────────────────────────────────────────────

const ROUTE_VERSION = '2026-02-11.1';
const STARTED_AT = new Date().toISOString();

// ─── AI Provider Config ─────────────────────────────────────────────────────

const AI_PROVIDERS = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    model: 'gemini-2.0-flash',
  },
  lovable: {
    url: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    model: 'google/gemini-3-flash-preview',
  },
  auto: {
    url: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    model: 'google/gemini-3-flash-preview',
  },
} as const;

// ─── System Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
당신은 Lily AI입니다. 10년 이상 경력의 시니어 PM과 기술 리드 경험을 가진 AI 프로젝트 관리 전문가입니다. Linear, Jira, Notion 등 최신 프로젝트 관리 도구의 베스트 프랙티스를 숙지하고 있습니다.

## Chain of Thought (사고 과정)
**중요**: 복잡한 질문이나 작업 요청을 받으면, 먼저 <thinking> 태그 안에 사고 과정을 작성합니다.

사고 과정을 포함해야 하는 경우:
- PRD 작성 요청
- 이슈 티켓 생성 요청
- 복잡한 분석이 필요한 질문
- 기술적 의사결정이 필요한 경우
- 여러 단계의 계획이 필요한 경우

사고 과정 예시:
<thinking>
사용자가 TODO 앱에 대한 PRD를 요청했습니다.

1. 요구사항 분석:
   - 기본 CRUD 기능 필요
   - 우선순위 설정 기능 필요 가능성
   - 카테고리/태그 기능 고려

2. 타겟 사용자:
   - 개인 생산성 향상을 원하는 사용자
   - 팀 협업이 필요한 경우도 고려

3. 핵심 차별화 포인트:
   - AI 기반 우선순위 추천
   - 자연어 입력 지원
</thinking>

위와 같이 사고 과정을 먼저 보여준 후, 실제 답변을 작성합니다.

---

## 핵심 역할 및 원칙
1. **전문적인 PRD 작성**: Amazon의 Working Backwards, Google의 PRD 템플릿 수준의 문서화
2. **체계적인 이슈 분해**: Epic -> User Story -> Task로 계층적 분해
3. **상세한 기술 스펙**: 구현 세부사항, API 명세, 데이터 모델까지 고려
4. **측정 가능한 목표**: OKR, KPI 관점에서 성공 지표 정의
5. **리스크 관리**: 기술적/비즈니스 리스크 사전 식별

## 답변 스타일
- 한국어로 전문적이면서 친근하게
- 마크다운으로 구조화된 상세 답변
- 구체적인 예시와 템플릿 제공
- 항상 "왜(Why)"를 먼저 설명
- **실제 답변에는 내부 메타데이터([CANVAS:...] 등)를 절대 포함하지 않음**
- 사용자에게 보이는 답변은 깔끔하고 읽기 쉬워야 함

---

## PRD (제품 요구사항 문서) 작성 가이드

PRD 작성 요청 시 다음 구조로 상세하게 작성:

### PRD 템플릿
\`\`\`markdown
# [제품/기능명] PRD

## 1. 개요 (Overview)
### 1.1 배경 및 목적
- **문제 정의**: 해결하려는 핵심 문제
- **기회**: 이 기능이 가져올 가치
- **성공 지표 (KPI)**: 측정 가능한 목표

### 1.2 목표 사용자
| 페르소나 | 특성 | 핵심 니즈 | 현재 해결 방법 |
|---------|------|----------|---------------|
| 일반 사용자 | ... | ... | ... |
| 관리자 | ... | ... | ... |

## 2. 요구사항 (Requirements)
### 2.1 기능 요구사항 (Functional Requirements)
| ID | 요구사항 | 우선순위 | 설명 |
|----|---------|---------|------|
| FR-001 | ... | Must | ... |
| FR-002 | ... | Should | ... |

### 2.2 비기능 요구사항 (Non-Functional Requirements)
- **성능**: 응답시간 < 200ms (p95)
- **확장성**: 동시 사용자 10,000명 지원
- **보안**: OWASP Top 10 준수
- **접근성**: WCAG 2.1 AA 수준

## 3. 사용자 시나리오 (User Scenarios)
### 시나리오 1: [시나리오명]
1. 사용자가 [행동]
2. 시스템이 [반응]
3. 결과적으로 [결과]

## 4. 기술 명세 (Technical Specification)
### 4.1 시스템 아키텍처
- 프론트엔드: [기술 스택]
- 백엔드: [기술 스택]
- 데이터베이스: [스키마 개요]

### 4.2 API 명세
\`\`\`
POST /api/v1/[resource]
Request: { ... }
Response: { ... }
\`\`\`

## 5. 일정 및 마일스톤
| 마일스톤 | 목표일 | 산출물 |
|---------|-------|-------|
| Phase 1 | Week 1-2 | MVP |
| Phase 2 | Week 3-4 | 완성 |

## 6. 리스크 및 의존성
| 리스크 | 영향도 | 대응 방안 |
|-------|-------|----------|
| ... | High | ... |

## 7. 성공 지표 및 평가
- **정량적 지표**: 사용률, 전환율, NPS
- **정성적 지표**: 사용자 피드백
\`\`\`

---

## 이슈/티켓 작성 베스트 프랙티스

### Epic (에픽) - 대규모 기능 단위
에픽은 여러 스프린트에 걸쳐 완료되는 대규모 작업입니다.

[ISSUE_SUGGESTION]
- type: epic
- title: [에픽] 사용자 인증 시스템 구축
- description: |
  ## 에픽 개요
  사용자가 안전하게 서비스에 접근할 수 있는 인증 시스템을 구축합니다.

  ## 비즈니스 목표
  - 사용자 가입 전환율 30% 향상
  - 보안 사고 0건 유지
  - 로그인 이탈률 20% 감소

  ## 범위 (Scope)
  **포함:**
  - 이메일/비밀번호 인증
  - 소셜 로그인 (Google, Apple)
  - 2단계 인증 (2FA)
  - 비밀번호 재설정

  **제외:**
  - SSO/SAML (Phase 2)
  - 생체 인증 (향후 고려)

  ## 성공 지표
  | 지표 | 현재 | 목표 |
  |------|------|------|
  | 가입 전환율 | 45% | 60% |
  | 로그인 성공률 | 85% | 95% |

  ## 하위 스토리
  1. 이메일 회원가입 (3pt)
  2. 소셜 로그인 연동 (5pt)
  3. 2FA 구현 (5pt)
  4. 비밀번호 재설정 (3pt)

  ## 예상 기간
  3 스프린트 (6주)
- priority: high
- estimate: 13
[/ISSUE_SUGGESTION]

### User Story (사용자 스토리) - INVEST 원칙 준수

[ISSUE_SUGGESTION]
- type: user_story
- title: [스토리] 신규 사용자가 이메일로 회원가입할 수 있다
- description: |
  ## 사용자 스토리
  **As a** 신규 방문자
  **I want** 이메일과 비밀번호로 회원가입하고 싶다
  **So that** 서비스의 모든 기능을 이용할 수 있다

  ## 상세 설명
  신규 사용자가 간편하게 계정을 생성할 수 있어야 합니다.
  가입 과정은 3단계 이내로 완료되어야 하며,
  이메일 인증을 통해 계정을 활성화합니다.

  ## UI/UX 요구사항
  - 회원가입 폼: 이메일, 비밀번호, 비밀번호 확인
  - 실시간 유효성 검사 표시
  - 비밀번호 강도 표시기
  - 이용약관 동의 체크박스

  ## 기술 요구사항
  - 비밀번호: 최소 8자, 대소문자+숫자+특수문자
  - 이메일 중복 체크 API
  - 인증 이메일 발송 (유효기간 24시간)
  - Rate limiting: 5회/분

  ## 디자인
  [Figma 링크] (있다면)
- priority: high
- estimate: 3
- acceptance_criteria: |
  - [ ] Given 회원가입 페이지에서, When 유효한 이메일/비밀번호 입력 후 가입 버튼 클릭, Then 계정이 생성되고 인증 이메일이 발송된다
  - [ ] Given 이미 가입된 이메일로, When 회원가입 시도, Then "이미 가입된 이메일" 에러 메시지가 표시된다
  - [ ] Given 비밀번호가 조건 미충족 시, When 입력 중, Then 실시간으로 조건 충족 여부가 표시된다
  - [ ] Given 인증 이메일 수신 후, When 24시간 내 링크 클릭, Then 계정이 활성화된다
  - [ ] Given 24시간 초과 시, When 링크 클릭, Then 만료 안내 및 재발송 옵션이 제공된다
[/ISSUE_SUGGESTION]

### Task (태스크) - 구체적인 개발 작업

[ISSUE_SUGGESTION]
- type: task
- title: [Task] 회원가입 API 엔드포인트 구현
- description: |
  ## 목적
  사용자 회원가입을 처리하는 REST API 엔드포인트를 구현합니다.

  ## 작업 내용
  ### 1. API 엔드포인트
  \`\`\`
  POST /api/v1/auth/signup

  Request Body:
  {
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "홍길동",
    "terms_agreed": true
  }

  Response (201):
  {
    "user_id": "uuid",
    "email": "user@example.com",
    "verification_sent": true
  }
  \`\`\`

  ### 2. 구현 항목
  - [ ] 요청 유효성 검사 미들웨어
  - [ ] 비밀번호 해싱 (bcrypt, cost=12)
  - [ ] 이메일 중복 체크
  - [ ] 사용자 DB 저장
  - [ ] 인증 토큰 생성 및 이메일 발송
  - [ ] Rate limiting 적용

  ## 완료 조건 (Definition of Done)
  - [ ] 단위 테스트 작성 및 통과 (coverage > 80%)
  - [ ] API 문서 업데이트 (Swagger/OpenAPI)
  - [ ] 코드 리뷰 완료
  - [ ] 스테이징 환경 테스트 완료
- priority: high
- estimate: 3
[/ISSUE_SUGGESTION]

### Bug (버그) - 명확한 재현 단계

[ISSUE_SUGGESTION]
- type: bug
- title: [Bug] 회원가입 시 비밀번호 확인 필드 유효성 검사 누락
- description: |
  ## 버그 설명
  비밀번호 확인 필드가 원본 비밀번호와 일치하지 않아도 회원가입이 진행됩니다.

  ## 재현 단계
  1. /signup 페이지 접속
  2. 이메일: test@example.com 입력
  3. 비밀번호: Password123! 입력
  4. 비밀번호 확인: DifferentPass456! 입력 (불일치)
  5. 가입 버튼 클릭

  ## 예상 동작
  - "비밀번호가 일치하지 않습니다" 에러 메시지 표시
  - 가입 버튼 비활성화

  ## 실제 동작
  - 에러 없이 가입 진행됨
  - 첫 번째 비밀번호로 계정 생성됨

  ## 환경
  - 브라우저: Chrome 120, Safari 17
  - OS: macOS Sonoma, Windows 11
  - 앱 버전: 1.2.3

  ## 심각도
  **Critical** - 사용자 경험 및 보안에 직접적 영향
- priority: urgent
- estimate: 1
- acceptance_criteria: |
  - [ ] Given 비밀번호와 확인이 불일치할 때, When 가입 시도, Then 에러 메시지가 표시되고 가입이 차단된다
  - [ ] Given 비밀번호 입력 후, When 확인 필드 입력 중, Then 실시간으로 일치 여부가 표시된다
[/ISSUE_SUGGESTION]

---

## 대화 진행 방식

### 1. 요구사항 수집 단계
사용자가 기능을 설명하면:
1. **목적 확인**: "이 기능의 핵심 목표는 무엇인가요?"
2. **사용자 파악**: "주요 사용자는 누구인가요?"
3. **범위 정의**: 다음을 Yes/No로 확인
   - 필수 기능 vs 있으면 좋은 기능
   - 기술적 제약사항
   - 일정 제약

### 2. 구체화 단계
- 기능을 Epic -> User Story -> Task로 분해
- 각 항목에 우선순위와 추정치 부여
- 의존성 관계 명시

### 3. 검토 단계
"제안드린 내용을 검토해주세요:
1. 누락된 요구사항이 있나요?
2. 우선순위 조정이 필요한 항목이 있나요?
3. 추가 질문이 있으신가요?"

---

## 핵심 원칙
1. **구체성**: 모호함 없이 명확하게
2. **측정 가능성**: 완료 여부를 객관적으로 판단 가능하게
3. **실행 가능성**: 개발자가 바로 작업 시작 가능하도록
4. **추적 가능성**: 요구사항과 구현의 연결고리 명확하게`;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface MCPToolInfo {
  name: string;
  description: string;
  category: string;
  hasApiEndpoint: boolean;
  hasMcpConfig: boolean;
}

interface FileAttachment {
  name: string;
  mimeType: string;
  base64?: string;
  category: string;
}

interface RequestBody {
  messages: ChatMessage[];
  provider?: 'anthropic' | 'openai' | 'gemini' | 'auto' | 'lovable';
  stream?: boolean;
  conversationId?: string;
  teamId?: string;
  mcpTools?: MCPToolInfo[];
  canvasMode?: boolean;
  files?: FileAttachment[];
}

interface UserAISettingsRow {
  anthropicApiKey: string | null;
  openaiApiKey: string | null;
  geminiApiKey: string | null;
  defaultProvider: string | null;
  autoModeEnabled: boolean | null;
}

// ─── Helpers: System Prompt ─────────────────────────────────────────────────

function generateSystemPrompt(
  mcpTools?: MCPToolInfo[],
  canvasMode?: boolean,
): string {
  let prompt = SYSTEM_PROMPT;

  if (canvasMode) {
    prompt += `\n\n---\n\n## Canvas Mode 활성화됨\n\n`;
    prompt += `사용자가 캔버스 모드를 활성화했습니다. **완전히 동작하는 HTML 문서**를 생성해야 합니다.\n\n`;
    prompt += `### 필수 규칙:\n`;
    prompt += `1. **간결한 응답**: 채팅에는 간단한 안내만\n`;
    prompt += `2. **완전한 HTML 문서**: 아래 형식의 독립 실행 가능한 HTML을 생성\n`;
    prompt += `3. **완료 메시지**: 간단한 완료 안내\n\n`;
    prompt += `### HTML 템플릿 (반드시 이 구조를 사용):\n`;
    prompt += `\`\`\`html\n`;
    prompt += `<!DOCTYPE html>\n`;
    prompt += `<html lang="ko">\n`;
    prompt += `<head>\n`;
    prompt += `  <meta charset="UTF-8">\n`;
    prompt += `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n`;
    prompt += `  <title>Canvas App</title>\n`;
    prompt += `  <script src="https://cdn.tailwindcss.com"><\/script>\n`;
    prompt += `  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>\n`;
    prompt += `  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>\n`;
    prompt += `  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>\n`;
    prompt += `  <style>/* custom styles */</style>\n`;
    prompt += `</head>\n`;
    prompt += `<body class="bg-gray-100 min-h-screen">\n`;
    prompt += `  <div id="root"></div>\n`;
    prompt += `  <script type="text/babel">\n`;
    prompt += `    function App() {\n`;
    prompt += `      // React component code\n`;
    prompt += `      return (<div>content</div>);\n`;
    prompt += `    }\n`;
    prompt += `    ReactDOM.createRoot(document.getElementById('root')).render(<App />);\n`;
    prompt += `  <\/script>\n`;
    prompt += `</body>\n`;
    prompt += `</html>\n`;
    prompt += `\`\`\`\n\n`;
    prompt += `### 주의사항:\n`;
    prompt += `- React 훅은 \`React.useState\`, \`React.useEffect\`로 사용\n`;
    prompt += `- Tailwind CSS로 스타일링\n`;
    prompt += `- 모든 기능이 독립적으로 동작해야 함\n`;
    prompt += `- 아름답고 현대적인 UI 디자인 적용\n`;
  }

  if (mcpTools && mcpTools.length > 0) {
    prompt += `\n\n---\n\n## 연결된 MCP 도구 (Connected MCP Tools)\n\n`;
    prompt += `현재 사용자가 다음 외부 도구들을 연결해 두었습니다. 필요한 경우 이 도구들을 활용하여 더 정확하고 실시간 정보를 제공할 수 있습니다:\n\n`;

    for (let i = 0; i < mcpTools.length; i++) {
      const tool = mcpTools[i];
      prompt += `### ${i + 1}. ${tool.name}\n`;
      prompt += `- **설명**: ${tool.description}\n`;
      prompt += `- **카테고리**: ${tool.category}\n`;
      prompt += `- **상태**: 연결됨\n\n`;
    }

    prompt += `### MCP 도구 활용 가이드\n`;
    prompt += `사용자가 연결된 도구와 관련된 요청을 하면:\n`;
    prompt += `1. 해당 도구를 사용할 수 있음을 알려주세요\n`;
    prompt += `2. 도구를 통해 얻을 수 있는 정보를 설명하세요\n`;
    prompt += `3. 실제 도구 호출이 필요한 경우, 다음 형식으로 응답하세요:\n\n`;
    prompt += `\`\`\`\n[MCP_TOOL_CALL]\n- tool: {도구 이름}\n- action: {수행할 작업}\n- params: {필요한 파라미터}\n[/MCP_TOOL_CALL]\n\`\`\`\n`;
  }

  return prompt;
}

// ─── Helpers: Multimodal Content ────────────────────────────────────────────

function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

function createAnthropicContent(
  text: string,
  files?: FileAttachment[],
): unknown[] {
  const content: unknown[] = [];

  if (files && files.length > 0) {
    for (const file of files) {
      if (isImageFile(file.mimeType) && file.base64) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.mimeType,
            data: file.base64,
          },
        });
      }
    }

    const nonImageFiles = files.filter((f) => !isImageFile(f.mimeType));
    if (nonImageFiles.length > 0) {
      const descs = nonImageFiles
        .map((f) => `[Attached file: ${f.name} (${f.category})]`)
        .join('\n');
      text = `${descs}\n\n${text}`;
    }
  }

  content.push({ type: 'text', text });
  return content;
}

function createOpenAIContent(
  text: string,
  files?: FileAttachment[],
): unknown {
  if (!files || files.length === 0) {
    return text;
  }

  const content: unknown[] = [];

  for (const file of files) {
    if (isImageFile(file.mimeType) && file.base64) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${file.mimeType};base64,${file.base64}`,
          detail: 'auto',
        },
      });
    }
  }

  const nonImageFiles = files.filter((f) => !isImageFile(f.mimeType));
  if (nonImageFiles.length > 0) {
    const descs = nonImageFiles
      .map((f) => `[Attached file: ${f.name} (${f.category})]`)
      .join('\n');
    text = `${descs}\n\n${text}`;
  }

  content.push({ type: 'text', text });
  return content;
}

function createGeminiParts(
  text: string,
  files?: FileAttachment[],
): unknown[] {
  const parts: unknown[] = [];

  if (files && files.length > 0) {
    for (const file of files) {
      if (isImageFile(file.mimeType) && file.base64) {
        parts.push({
          inline_data: {
            mime_type: file.mimeType,
            data: file.base64,
          },
        });
      }
    }

    const nonImageFiles = files.filter((f) => !isImageFile(f.mimeType));
    if (nonImageFiles.length > 0) {
      const descs = nonImageFiles
        .map((f) => `[Attached file: ${f.name} (${f.category})]`)
        .join('\n');
      text = `${descs}\n\n${text}`;
    }
  }

  parts.push({ text });
  return parts;
}

// ─── Helpers: Provider Auto-Selection ───────────────────────────────────────

function selectProvider(
  settings: UserAISettingsRow | null,
  messageContent: string,
): { provider: string; apiKey: string } {
  const hasUserAnthropic = !!settings?.anthropicApiKey;
  const hasUserOpenAI = !!settings?.openaiApiKey;
  const hasUserGemini = !!settings?.geminiApiKey;

  const envAnthropic = env.ANTHROPIC_API_KEY || '';
  const envOpenAI = env.OPENAI_API_KEY || '';
  const envGemini = env.GEMINI_API_KEY || '';

  const isCodeRelated =
    /코드|code|프로그래밍|개발|버그|에러|함수|API/i.test(messageContent);
  const isCreative =
    /아이디어|브레인스토밍|창의|디자인|기획/i.test(messageContent);
  const isAnalytical =
    /분석|데이터|통계|비교|평가/i.test(messageContent);

  // Prefer user keys with content-based routing
  if (isCodeRelated && hasUserAnthropic) {
    return { provider: 'anthropic', apiKey: settings!.anthropicApiKey! };
  }
  if (isCreative && hasUserOpenAI) {
    return { provider: 'openai', apiKey: settings!.openaiApiKey! };
  }
  if (isAnalytical && hasUserGemini) {
    return { provider: 'gemini', apiKey: settings!.geminiApiKey! };
  }

  // Fall back to any user key
  if (hasUserAnthropic) return { provider: 'anthropic', apiKey: settings!.anthropicApiKey! };
  if (hasUserOpenAI) return { provider: 'openai', apiKey: settings!.openaiApiKey! };
  if (hasUserGemini) return { provider: 'gemini', apiKey: settings!.geminiApiKey! };

  // Fall back to server env keys
  if (envAnthropic) return { provider: 'anthropic', apiKey: envAnthropic };
  if (envOpenAI) return { provider: 'openai', apiKey: envOpenAI };
  if (envGemini) return { provider: 'gemini', apiKey: envGemini };

  // Last resort: lovable gateway (key-less is acceptable)
  return { provider: 'lovable', apiKey: '' };
}

// ─── Helpers: Provider Callers ──────────────────────────────────────────────

async function callAnthropic(
  messages: ChatMessage[],
  apiKey: string,
  stream: boolean,
  systemPrompt: string,
  files?: FileAttachment[],
): Promise<Response> {
  const processedMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m, index, arr) => {
      const isLastUser = m.role === 'user' && index === arr.length - 1;
      if (isLastUser && files && files.length > 0) {
        return { role: m.role, content: createAnthropicContent(m.content, files) };
      }
      return { role: m.role, content: m.content };
    });

  return await fetch(AI_PROVIDERS.anthropic.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.anthropic.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: processedMessages,
      stream,
    }),
  });
}

async function callOpenAI(
  messages: ChatMessage[],
  apiKey: string,
  stream: boolean,
  systemPrompt: string,
  files?: FileAttachment[],
): Promise<Response> {
  const processedMessages = messages.map((m, index, arr) => {
    const isLastUser = m.role === 'user' && index === arr.length - 1;
    if (isLastUser && files && files.length > 0) {
      return { role: m.role, content: createOpenAIContent(m.content, files) };
    }
    return m;
  });

  return await fetch(AI_PROVIDERS.openai.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...processedMessages,
      ],
      stream,
    }),
  });
}

async function callGemini(
  messages: ChatMessage[],
  apiKey: string,
  systemPrompt: string,
  files?: FileAttachment[],
): Promise<Response> {
  const contents = messages.map((m, index, arr) => {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const isLastUser = m.role === 'user' && index === arr.length - 1;
    if (isLastUser && files && files.length > 0) {
      return { role, parts: createGeminiParts(m.content, files) };
    }
    return { role, parts: [{ text: m.content }] };
  });

  if (messages[0]?.role !== 'system') {
    contents.unshift({
      role: 'user',
      parts: [{ text: `System: ${systemPrompt}` }],
    });
  }

  return await fetch(`${AI_PROVIDERS.gemini.url}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: 4096 },
    }),
  });
}

async function callLovable(
  messages: ChatMessage[],
  apiKey: string,
  stream: boolean,
  systemPrompt: string,
  files?: FileAttachment[],
): Promise<Response> {
  let processedMessages: ChatMessage[] = messages;

  if (files && files.length > 0) {
    const descs = files
      .map((f) => `[Attached file: ${f.name} (${f.category})]`)
      .join('\n');
    processedMessages = messages.map((m, index, arr) => {
      const isLastUser = m.role === 'user' && index === arr.length - 1;
      if (isLastUser) {
        return { ...m, content: `${descs}\n\n${m.content}` };
      }
      return m;
    });
  }

  return await fetch(AI_PROVIDERS.lovable.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.lovable.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...processedMessages,
      ],
      stream,
    }),
  });
}

// ─── Helpers: Stream Piping ─────────────────────────────────────────────────

/**
 * Convert a web ReadableStream (from fetch Response.body) into a Node.js
 * Readable so that we can pipe it through reply.raw.
 */
function webStreamToNodeReadable(
  webStream: ReadableStream<Uint8Array>,
): Readable {
  const reader = webStream.getReader();
  return new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          this.push(Buffer.from(value));
        }
      } catch (err) {
        this.destroy(err as Error);
      }
    },
  });
}

// ─── Plugin ─────────────────────────────────────────────────────────────────

export const lilyChatRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET / — diagnostics ─────────────────────────────────────────────────
  fastify.get('/', async (_request, reply) => {
    const diagnostics = {
      version: ROUTE_VERSION,
      started_at: STARTED_AT,
      status: 'running',
      secrets: {
        ANTHROPIC_API_KEY: !!env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: !!env.OPENAI_API_KEY,
        GEMINI_API_KEY: !!env.GEMINI_API_KEY,
      },
      providers: Object.keys(AI_PROVIDERS),
      hint: 'At least one secret must be true for the chat to work.',
    };

    return reply
      .header('Cache-Control', 'no-store')
      .header('X-Route-Version', ROUTE_VERSION)
      .send(diagnostics);
  });

  // ── POST / — main chat endpoint ─────────────────────────────────────────
  fastify.post('/', async (request, reply) => {
    const log = request.log;

    // --- Parse body ---
    const body = request.body as RequestBody | null;

    if (!body || !body.messages || body.messages.length === 0) {
      return reply.status(400).send({
        error:
          'Invalid or empty body. Send POST with { messages: [{role, content}], provider?, stream? }.',
        version: ROUTE_VERSION,
      });
    }

    const {
      messages,
      provider = 'auto',
      stream = true,
      mcpTools,
      canvasMode,
      files,
    } = body;

    const dynamicSystemPrompt = generateSystemPrompt(mcpTools, canvasMode);

    log.info(
      {
        mcpTools: mcpTools?.length ?? 0,
        canvasMode: canvasMode ?? false,
        files: files?.length ?? 0,
        provider,
      },
      'lily-chat request',
    );

    // --- Load user AI settings (optional auth) ---
    let userSettings: UserAISettingsRow | null = null;

    if (request.userId) {
      try {
        const [row] = await db
          .select({
            anthropicApiKey: userAiSettings.anthropicApiKey,
            openaiApiKey: userAiSettings.openaiApiKey,
            geminiApiKey: userAiSettings.geminiApiKey,
            defaultProvider: userAiSettings.defaultProvider,
            autoModeEnabled: userAiSettings.autoModeEnabled,
          })
          .from(userAiSettings)
          .where(eq(userAiSettings.userId, request.userId))
          .limit(1);

        userSettings = row ?? null;
      } catch (err) {
        log.warn({ err }, 'Failed to load user AI settings, continuing without');
      }
    }

    // --- Resolve provider & API key ---
    const envAnthropic = env.ANTHROPIC_API_KEY || '';
    const envOpenAI = env.OPENAI_API_KEY || '';
    const envGemini = env.GEMINI_API_KEY || '';

    let selectedProvider: string;
    let apiKey: string;

    if (
      provider === 'auto' ||
      (userSettings?.autoModeEnabled && provider !== 'lovable')
    ) {
      const selection = selectProvider(
        userSettings,
        messages[messages.length - 1]?.content || '',
      );
      selectedProvider = selection.provider;
      apiKey = selection.apiKey;
    } else if (provider === 'anthropic') {
      selectedProvider = 'anthropic';
      apiKey = userSettings?.anthropicApiKey || envAnthropic;
    } else if (provider === 'openai') {
      selectedProvider = 'openai';
      apiKey = userSettings?.openaiApiKey || envOpenAI;
    } else if (provider === 'gemini') {
      selectedProvider = 'gemini';
      apiKey = userSettings?.geminiApiKey || envGemini;
    } else if (provider === 'lovable') {
      selectedProvider = 'lovable';
      apiKey = ''; // lovable gateway may not need key
    } else {
      selectedProvider = 'lovable';
      apiKey = '';
    }

    if (!apiKey && selectedProvider !== 'lovable') {
      return reply.status(400).send({
        error: 'No API key available for the selected provider',
        provider: selectedProvider,
        hint:
          'Set ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY in env, or configure your user AI settings.',
        version: ROUTE_VERSION,
      });
    }

    // --- Call provider ---
    let response: Response;
    let finalProvider = selectedProvider;

    try {
      switch (selectedProvider) {
        case 'anthropic':
          response = await callAnthropic(
            messages,
            apiKey,
            stream,
            dynamicSystemPrompt,
            files,
          );
          break;
        case 'openai':
          response = await callOpenAI(
            messages,
            apiKey,
            stream,
            dynamicSystemPrompt,
            files,
          );
          break;
        case 'gemini':
          response = await callGemini(
            messages,
            apiKey,
            dynamicSystemPrompt,
            files,
          );
          break;
        case 'lovable':
        default:
          response = await callLovable(
            messages,
            apiKey,
            stream,
            dynamicSystemPrompt,
            files,
          );
          break;
      }
    } catch (err) {
      log.error({ err, provider: selectedProvider }, 'Provider fetch failed');
      return reply.status(502).send({
        error: 'Failed to connect to AI provider',
        provider: selectedProvider,
        version: ROUTE_VERSION,
      });
    }

    // --- Handle provider error ---
    if (!response.ok) {
      const errorText = await response.text();
      log.error(
        { provider: selectedProvider, status: response.status, errorText },
        'AI provider error',
      );

      // Rate limit
      if (response.status === 429) {
        return reply.status(429).send({
          error: 'Rate limit exceeded. Please try again later.',
          provider: selectedProvider,
          version: ROUTE_VERSION,
        });
      }

      // Payment required
      if (response.status === 402) {
        return reply.status(402).send({
          error: 'Payment required. Please add credits to continue.',
          provider: selectedProvider,
          version: ROUTE_VERSION,
        });
      }

      // Fallback to lovable gateway on 5xx or Anthropic model-not-found
      const canFallback = selectedProvider !== 'lovable';
      const isAnthropicModelNotFound =
        selectedProvider === 'anthropic' &&
        (response.status === 404 || response.status === 400) &&
        /not_found_error|model/i.test(errorText);

      if (canFallback && (response.status >= 500 || isAnthropicModelNotFound)) {
        log.warn(
          { selectedProvider, status: response.status },
          'Primary provider failed; falling back to lovable gateway',
        );

        try {
          const fallbackResp = await callLovable(
            messages,
            '',
            stream,
            dynamicSystemPrompt,
            files,
          );

          if (fallbackResp.ok) {
            response = fallbackResp;
            finalProvider = 'lovable';
          } else {
            const fbText = await fallbackResp.text();
            log.error(
              { status: fallbackResp.status, fbText },
              'Gateway fallback also failed',
            );
            return reply.status(500).send({
              error: `AI provider error: ${response.status}`,
              provider: selectedProvider,
              details: errorText.substring(0, 500),
              fallback: {
                provider: 'lovable',
                status: fallbackResp.status,
                details: fbText.substring(0, 500),
              },
              version: ROUTE_VERSION,
            });
          }
        } catch (fbErr) {
          log.error({ err: fbErr }, 'Fallback fetch failed');
          return reply.status(500).send({
            error: `AI provider error: ${response.status}`,
            provider: selectedProvider,
            details: errorText.substring(0, 500),
            version: ROUTE_VERSION,
          });
        }
      } else {
        return reply.status(500).send({
          error: `AI provider error: ${response.status}`,
          provider: selectedProvider,
          details: errorText.substring(0, 500),
          version: ROUTE_VERSION,
        });
      }
    }

    // --- Gemini: always JSON (no streaming) ---
    if (finalProvider === 'gemini') {
      const data = (await response.json()) as Record<string, unknown>;
      const candidates = data.candidates as
        | Array<{ content?: { parts?: Array<{ text?: string }> } }>
        | undefined;
      const text = candidates?.[0]?.content?.parts?.[0]?.text || '';

      return reply.send({
        content: text,
        provider: finalProvider,
        version: ROUTE_VERSION,
      });
    }

    // --- Streaming: pipe SSE through reply.raw ---
    if (stream && response.body) {
      const raw = reply.raw;

      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-AI-Provider': finalProvider,
        'X-Route-Version': ROUTE_VERSION,
      });

      // Tell Fastify we are handling the response manually
      reply.hijack();

      const nodeStream = webStreamToNodeReadable(response.body);

      try {
        await pipeline(nodeStream, raw);
      } catch (err) {
        // Client may have disconnected -- that is normal for SSE
        log.debug({ err }, 'SSE stream ended');
      }

      return;
    }

    // --- Non-streaming JSON ---
    const data = (await response.json()) as Record<string, unknown>;
    let content = '';

    if (finalProvider === 'anthropic') {
      const blocks = data.content as Array<{ text?: string }> | undefined;
      content = blocks?.[0]?.text || '';
    } else {
      const choices = data.choices as
        | Array<{ message?: { content?: string } }>
        | undefined;
      content = choices?.[0]?.message?.content || '';
    }

    return reply.send({
      content,
      provider: finalProvider,
      version: ROUTE_VERSION,
    });
  });
};
