import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Bump this string to verify which deployment is actually running.
const FUNCTION_VERSION = "2026-02-04.3";
const DEPLOYED_AT = new Date().toISOString();

// AI Provider configurations
const AI_PROVIDERS = {
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    model: "claude-sonnet-4-20250514",
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o",
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    model: "gemini-2.0-flash",
  },
  lovable: {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    model: "google/gemini-3-flash-preview",
  },
  auto: {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    model: "google/gemini-3-flash-preview",
  },
} as const;

const SYSTEM_PROMPT = `당신은 Lily AI입니다. 10년 이상 경력의 시니어 PM과 기술 리드 경험을 가진 AI 프로젝트 관리 전문가입니다. Linear, Jira, Notion 등 최신 프로젝트 관리 도구의 베스트 프랙티스를 숙지하고 있습니다.

## 핵심 역할 및 원칙
1. **전문적인 PRD 작성**: Amazon의 Working Backwards, Google의 PRD 템플릿 수준의 문서화
2. **체계적인 이슈 분해**: Epic → User Story → Task로 계층적 분해
3. **상세한 기술 스펙**: 구현 세부사항, API 명세, 데이터 모델까지 고려
4. **측정 가능한 목표**: OKR, KPI 관점에서 성공 지표 정의
5. **리스크 관리**: 기술적/비즈니스 리스크 사전 식별

## 답변 스타일
- 한국어로 전문적이면서 친근하게
- 마크다운으로 구조화된 상세 답변
- 구체적인 예시와 템플릿 제공
- 항상 "왜(Why)"를 먼저 설명

---

## 📋 PRD (제품 요구사항 문서) 작성 가이드

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

## 🎫 이슈/티켓 작성 베스트 프랙티스

### ⚡ Epic (에픽) - 대규모 기능 단위
에픽은 여러 스프린트에 걸쳐 완료되는 대규모 작업입니다.

[ISSUE_SUGGESTION]
- type: epic
- title: [에픽] 사용자 인증 시스템 구축
- description: |
  ## 📌 에픽 개요
  사용자가 안전하게 서비스에 접근할 수 있는 인증 시스템을 구축합니다.
  
  ## 🎯 비즈니스 목표
  - 사용자 가입 전환율 30% 향상
  - 보안 사고 0건 유지
  - 로그인 이탈률 20% 감소
  
  ## 📋 범위 (Scope)
  **포함:**
  - 이메일/비밀번호 인증
  - 소셜 로그인 (Google, Apple)
  - 2단계 인증 (2FA)
  - 비밀번호 재설정
  
  **제외:**
  - SSO/SAML (Phase 2)
  - 생체 인증 (향후 고려)
  
  ## 📊 성공 지표
  | 지표 | 현재 | 목표 |
  |------|------|------|
  | 가입 전환율 | 45% | 60% |
  | 로그인 성공률 | 85% | 95% |
  
  ## 🔗 하위 스토리
  1. 이메일 회원가입 (3pt)
  2. 소셜 로그인 연동 (5pt)
  3. 2FA 구현 (5pt)
  4. 비밀번호 재설정 (3pt)
  
  ## ⏱️ 예상 기간
  3 스프린트 (6주)
- priority: high
- estimate: 13
[/ISSUE_SUGGESTION]

### 🎯 User Story (사용자 스토리) - INVEST 원칙 준수

[ISSUE_SUGGESTION]
- type: user_story
- title: [스토리] 신규 사용자가 이메일로 회원가입할 수 있다
- description: |
  ## 📝 사용자 스토리
  **As a** 신규 방문자
  **I want** 이메일과 비밀번호로 회원가입하고 싶다
  **So that** 서비스의 모든 기능을 이용할 수 있다
  
  ## 💡 상세 설명
  신규 사용자가 간편하게 계정을 생성할 수 있어야 합니다.
  가입 과정은 3단계 이내로 완료되어야 하며, 
  이메일 인증을 통해 계정을 활성화합니다.
  
  ## 📐 UI/UX 요구사항
  - 회원가입 폼: 이메일, 비밀번호, 비밀번호 확인
  - 실시간 유효성 검사 표시
  - 비밀번호 강도 표시기
  - 이용약관 동의 체크박스
  
  ## 🔧 기술 요구사항
  - 비밀번호: 최소 8자, 대소문자+숫자+특수문자
  - 이메일 중복 체크 API
  - 인증 이메일 발송 (유효기간 24시간)
  - Rate limiting: 5회/분
  
  ## 🎨 디자인
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

### ✅ Task (태스크) - 구체적인 개발 작업

[ISSUE_SUGGESTION]
- type: task
- title: [Task] 회원가입 API 엔드포인트 구현
- description: |
  ## 🎯 목적
  사용자 회원가입을 처리하는 REST API 엔드포인트를 구현합니다.
  
  ## 📋 작업 내용
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
  
  Error (400):
  {
    "error": "VALIDATION_ERROR",
    "message": "비밀번호는 8자 이상이어야 합니다",
    "field": "password"
  }
  \`\`\`
  
  ### 2. 구현 항목
  - [ ] 요청 유효성 검사 미들웨어
  - [ ] 비밀번호 해싱 (bcrypt, cost=12)
  - [ ] 이메일 중복 체크
  - [ ] 사용자 DB 저장
  - [ ] 인증 토큰 생성 및 이메일 발송
  - [ ] Rate limiting 적용
  
  ### 3. 에러 처리
  | 상황 | HTTP 코드 | 에러 코드 |
  |------|----------|----------|
  | 이메일 중복 | 409 | EMAIL_EXISTS |
  | 유효성 실패 | 400 | VALIDATION_ERROR |
  | 서버 오류 | 500 | INTERNAL_ERROR |
  
  ## ✅ 완료 조건 (Definition of Done)
  - [ ] 단위 테스트 작성 및 통과 (coverage > 80%)
  - [ ] API 문서 업데이트 (Swagger/OpenAPI)
  - [ ] 코드 리뷰 완료
  - [ ] 스테이징 환경 테스트 완료
  
  ## 🔗 의존성
  - 선행: 데이터베이스 스키마 마이그레이션
  - 후행: 프론트엔드 회원가입 폼 연동
- priority: high
- estimate: 3
[/ISSUE_SUGGESTION]

### 🐛 Bug (버그) - 명확한 재현 단계

[ISSUE_SUGGESTION]
- type: bug
- title: [Bug] 회원가입 시 비밀번호 확인 필드 유효성 검사 누락
- description: |
  ## 🐛 버그 설명
  비밀번호 확인 필드가 원본 비밀번호와 일치하지 않아도 회원가입이 진행됩니다.
  
  ## 🔄 재현 단계
  1. /signup 페이지 접속
  2. 이메일: test@example.com 입력
  3. 비밀번호: Password123! 입력
  4. 비밀번호 확인: DifferentPass456! 입력 (불일치)
  5. 가입 버튼 클릭
  
  ## ✅ 예상 동작
  - "비밀번호가 일치하지 않습니다" 에러 메시지 표시
  - 가입 버튼 비활성화
  
  ## ❌ 실제 동작
  - 에러 없이 가입 진행됨
  - 첫 번째 비밀번호로 계정 생성됨
  
  ## 🌍 환경
  - 브라우저: Chrome 120, Safari 17
  - OS: macOS Sonoma, Windows 11
  - 앱 버전: 1.2.3
  
  ## 📊 심각도
  **Critical** - 사용자 경험 및 보안에 직접적 영향
  
  ## 📸 스크린샷/로그
  [첨부]
  
  ## 💡 예상 원인
  프론트엔드 유효성 검사 로직에서 비밀번호 확인 필드 검증 누락
- priority: urgent
- estimate: 1
- acceptance_criteria: |
  - [ ] Given 비밀번호와 확인이 불일치할 때, When 가입 시도, Then 에러 메시지가 표시되고 가입이 차단된다
  - [ ] Given 비밀번호 입력 후, When 확인 필드 입력 중, Then 실시간으로 일치 여부가 표시된다
[/ISSUE_SUGGESTION]

---

## 🔄 대화 진행 방식

### 1. 요구사항 수집 단계
사용자가 기능을 설명하면:
1. **목적 확인**: "이 기능의 핵심 목표는 무엇인가요?"
2. **사용자 파악**: "주요 사용자는 누구인가요?"
3. **범위 정의**: 다음을 Yes/No로 확인
   - 필수 기능 vs 있으면 좋은 기능
   - 기술적 제약사항
   - 일정 제약

### 2. 구체화 단계
- 기능을 Epic → User Story → Task로 분해
- 각 항목에 우선순위와 추정치 부여
- 의존성 관계 명시

### 3. 검토 단계
"제안드린 내용을 검토해주세요:
1. 누락된 요구사항이 있나요?
2. 우선순위 조정이 필요한 항목이 있나요?
3. 추가 질문이 있으신가요?"

---

## 💡 핵심 원칙
1. **구체성**: 모호함 없이 명확하게
2. **측정 가능성**: 완료 여부를 객관적으로 판단 가능하게
3. **실행 가능성**: 개발자가 바로 작업 시작 가능하도록
4. **추적 가능성**: 요구사항과 구현의 연결고리 명확하게`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  provider?: "anthropic" | "openai" | "gemini" | "auto" | "lovable";
  stream?: boolean;
  conversationId?: string;
  teamId?: string;
}

async function callAnthropic(messages: ChatMessage[], apiKey: string, stream: boolean) {
  return await fetch(AI_PROVIDERS.anthropic.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.anthropic.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content })),
      stream,
    }),
  });
}

async function callOpenAI(messages: ChatMessage[], apiKey: string, stream: boolean) {
  return await fetch(AI_PROVIDERS.openai.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.openai.model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream,
    }),
  });
}

async function callGemini(messages: ChatMessage[], apiKey: string) {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  if (messages[0]?.role !== "system") {
    contents.unshift({
      role: "user",
      parts: [{ text: `System: ${SYSTEM_PROMPT}` }],
    });
  }

  return await fetch(`${AI_PROVIDERS.gemini.url}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: 4096 },
    }),
  });
}

async function callLovable(messages: ChatMessage[], apiKey: string, stream: boolean) {
  return await fetch(AI_PROVIDERS.lovable.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.lovable.model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream,
    }),
  });
}

function selectProvider(
  userSettings:
    | { anthropic_api_key?: string; openai_api_key?: string; gemini_api_key?: string }
    | null,
  messageContent: string,
): { provider: string; apiKey: string } {
  const hasUserAnthropic = !!userSettings?.anthropic_api_key;
  const hasUserOpenAI = !!userSettings?.openai_api_key;
  const hasUserGemini = !!userSettings?.gemini_api_key;

  const anthropicSecret = Deno.env.get("ANTHROPIC_API_KEY");
  const openaiSecret = Deno.env.get("OPENAI_API_KEY");
  const geminiSecret = Deno.env.get("GEMINI_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  const isCodeRelated = /코드|code|프로그래밍|개발|버그|에러|함수|API/i.test(messageContent);
  const isCreative = /아이디어|브레인스토밍|창의|디자인|기획/i.test(messageContent);
  const isAnalytical = /분석|데이터|통계|비교|평가/i.test(messageContent);

  if (isCodeRelated && hasUserAnthropic) {
    return { provider: "anthropic", apiKey: userSettings!.anthropic_api_key! };
  }
  if (isCreative && hasUserOpenAI) {
    return { provider: "openai", apiKey: userSettings!.openai_api_key! };
  }
  if (isAnalytical && hasUserGemini) {
    return { provider: "gemini", apiKey: userSettings!.gemini_api_key! };
  }

  if (hasUserAnthropic) return { provider: "anthropic", apiKey: userSettings!.anthropic_api_key! };
  if (hasUserOpenAI) return { provider: "openai", apiKey: userSettings!.openai_api_key! };
  if (hasUserGemini) return { provider: "gemini", apiKey: userSettings!.gemini_api_key! };

  if (anthropicSecret) return { provider: "anthropic", apiKey: anthropicSecret };
  if (openaiSecret) return { provider: "openai", apiKey: openaiSecret };
  if (geminiSecret) return { provider: "gemini", apiKey: geminiSecret };
  if (lovableKey) return { provider: "lovable", apiKey: lovableKey };

  return { provider: "lovable", apiKey: "" };
}

serve(async (req) => {
  console.log(`[lily-chat ${FUNCTION_VERSION}] ${req.method} ${new URL(req.url).pathname}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  }

  if (req.method === "GET") {
    const diagnostics = {
      version: FUNCTION_VERSION,
      deployed_at: DEPLOYED_AT,
      status: "running",
      env: {
        SUPABASE_URL: !!Deno.env.get("SUPABASE_URL"),
        SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      },
      secrets: {
        ANTHROPIC_API_KEY: !!Deno.env.get("ANTHROPIC_API_KEY"),
        OPENAI_API_KEY: !!Deno.env.get("OPENAI_API_KEY"),
        GEMINI_API_KEY: !!Deno.env.get("GEMINI_API_KEY"),
        LOVABLE_API_KEY: !!Deno.env.get("LOVABLE_API_KEY"),
      },
      hint: "At least one secret must be 'true' for the chat to work.",
    };

    return new Response(JSON.stringify(diagnostics, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Function-Version": FUNCTION_VERSION,
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: `Method not allowed: ${req.method}`, version: FUNCTION_VERSION }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  try {
    let parsedBody: RequestBody;
    try {
      parsedBody = (await req.json()) as RequestBody;
    } catch (_e) {
      return new Response(
        JSON.stringify({
          error: "Invalid or empty JSON body. Send POST with { messages: [{role, content}], provider?, stream? }.",
          version: FUNCTION_VERSION,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
      );
    }

    const { messages, provider = "auto", stream = true, conversationId, teamId } = parsedBody;
    void conversationId;
    void teamId;

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required", version: FUNCTION_VERSION }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing backend environment variables", {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey,
        version: FUNCTION_VERSION,
      });
      return new Response(
        JSON.stringify({
          error: "Server configuration error: missing backend environment variables",
          version: FUNCTION_VERSION,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userSettings:
      | {
          anthropic_api_key?: string;
          openai_api_key?: string;
          gemini_api_key?: string;
          default_provider?: string;
          auto_mode_enabled?: boolean;
        }
      | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      userId = user?.id || null;

      if (userId) {
        const { data: settings } = await supabase
          .from("user_ai_settings")
          .select("*")
          .eq("user_id", userId)
          .single();
        userSettings = settings;
      }
    }

    let selectedProvider: string;
    let apiKey: string;

    const envAnthropic = Deno.env.get("ANTHROPIC_API_KEY") || "";
    const envOpenAI = Deno.env.get("OPENAI_API_KEY") || "";
    const envGemini = Deno.env.get("GEMINI_API_KEY") || "";
    const envLovable = Deno.env.get("LOVABLE_API_KEY") || "";

    if (provider === "auto" || (userSettings?.auto_mode_enabled && provider !== "lovable")) {
      const selection = selectProvider(userSettings, messages[messages.length - 1]?.content || "");
      selectedProvider = selection.provider;
      apiKey = selection.apiKey;
    } else if (provider === "anthropic") {
      selectedProvider = "anthropic";
      apiKey = userSettings?.anthropic_api_key || envAnthropic;
    } else if (provider === "openai") {
      selectedProvider = "openai";
      apiKey = userSettings?.openai_api_key || envOpenAI;
    } else if (provider === "gemini") {
      selectedProvider = "gemini";
      apiKey = userSettings?.gemini_api_key || envGemini;
    } else if (provider === "lovable") {
      selectedProvider = "lovable";
      apiKey = envLovable;
    } else {
      selectedProvider = "lovable";
      apiKey = envLovable;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "No API key available for the selected provider",
          provider: selectedProvider,
          hint:
            "Set the corresponding project secret (ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY / LOVABLE_API_KEY) or use provider='auto'.",
          version: FUNCTION_VERSION,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
      );
    }

    let response: Response;
    let finalProvider = selectedProvider;

    switch (selectedProvider) {
      case "anthropic":
        response = await callAnthropic(messages, apiKey, stream);
        break;
      case "openai":
        response = await callOpenAI(messages, apiKey, stream);
        break;
      case "gemini":
        response = await callGemini(messages, apiKey);
        break;
      case "lovable":
      default:
        response = await callLovable(messages, apiKey, stream);
        break;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${selectedProvider} API error:`, response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later.", provider: selectedProvider, version: FUNCTION_VERSION }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue.", provider: selectedProvider, version: FUNCTION_VERSION }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      }

      const canFallbackToGateway = selectedProvider !== "lovable" && !!envLovable;
      const isAnthropicModelNotFound =
        selectedProvider === "anthropic" &&
        (response.status === 404 || response.status === 400) &&
        /not_found_error|model/i.test(errorText);

      if (canFallbackToGateway && (response.status >= 500 || isAnthropicModelNotFound)) {
        console.warn("Primary provider failed; falling back to gateway", {
          selectedProvider,
          status: response.status,
          version: FUNCTION_VERSION,
        });

        const fallbackResp = await callLovable(messages, envLovable, stream);
        if (fallbackResp.ok) {
          response = fallbackResp;
          finalProvider = "lovable";
        } else {
          const fbText = await fallbackResp.text();
          console.error("Gateway fallback API error:", fallbackResp.status, fbText);
          return new Response(
            JSON.stringify({
              error: `AI provider error: ${response.status}`,
              provider: selectedProvider,
              details: errorText.substring(0, 500),
              fallback: {
                provider: "lovable",
                status: fallbackResp.status,
                details: fbText.substring(0, 500),
              },
              version: FUNCTION_VERSION,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
          );
        }
      } else {
        return new Response(
          JSON.stringify({
            error: `AI provider error: ${response.status}`,
            provider: selectedProvider,
            details: errorText.substring(0, 500),
            version: FUNCTION_VERSION,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      }
    }

    if (finalProvider === "gemini") {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return new Response(JSON.stringify({ content: text, provider: finalProvider, version: FUNCTION_VERSION }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    if (stream) {
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          "X-AI-Provider": finalProvider,
          "X-Function-Version": FUNCTION_VERSION,
        },
      });
    }

    const data = await response.json();
    let content = "";
    if (finalProvider === "anthropic") {
      content = data.content?.[0]?.text || "";
    } else {
      content = data.choices?.[0]?.message?.content || "";
    }

    return new Response(JSON.stringify({ content, provider: finalProvider, version: FUNCTION_VERSION }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        version: FUNCTION_VERSION,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  }
});

