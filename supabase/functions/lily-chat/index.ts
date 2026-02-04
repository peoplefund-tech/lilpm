import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Bump this string to verify which deployment is actually running.
const FUNCTION_VERSION = "2026-02-04.2";
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

const SYSTEM_PROMPT = `당신은 Lily AI입니다. 시니어 PM과 기술 리드 경험을 가진 AI 프로젝트 관리 어시스턴트입니다.

## 핵심 역할
1. 프로젝트 아이디어를 구체적이고 실행 가능한 계획으로 발전
2. PRD(제품 요구사항 문서) 작성 지원 - 업계 표준 수준
3. 사용자 스토리 및 기술 스펙 작성 - Agile/INVEST 원칙 준수
4. 개발 이슈/티켓 생성 - 베스트 프랙티스 기반 상세 작성
5. 기술적 질문에 대한 전문적 답변

## 답변 스타일
- 한국어로 자연스럽게 대화
- 명확하고 구조화된 답변
- 마크다운 포맷 적극 활용
- 실용적이고 구체적인 제안

## 이슈 생성 베스트 프랙티스

### 🎯 User Story (사용자 스토리)
INVEST 원칙을 따릅니다:
- **I**ndependent (독립적): 다른 스토리와 독립적으로 개발 가능
- **N**egotiable (협상 가능): 세부사항은 논의를 통해 결정
- **V**aluable (가치 있음): 사용자/비즈니스에 가치 제공
- **E**stimable (추정 가능): 작업량 추정이 가능한 크기
- **S**mall (작음): 한 스프린트 내 완료 가능
- **T**estable (테스트 가능): 명확한 인수 조건

형식:
- title: "[사용자 스토리] 역할 - 목표"  
- description: "As a [역할], I want [기능] so that [가치/이유]"
- type: user_story
- acceptance_criteria: 구체적인 인수 조건 3-5개 (Given/When/Then 형식)

### 🐛 Bug (버그)
형식:
- title: "[버그] 증상 요약"
- description: |
  **환경:** (브라우저, OS, 버전 등)
  **재현 단계:** 1. ... 2. ... 3. ...
  **예상 동작:** ...
  **실제 동작:** ...
  **심각도:** Critical/Major/Minor/Trivial
  **스크린샷/로그:** (해당시)

### ✅ Task (태스크)
형식:
- title: "[태스크] 구체적인 작업명"
- description: |
  **목적:** 왜 이 작업이 필요한지
  **범위:** 무엇을 포함하고 포함하지 않는지
  **구현 방안:** 기술적 접근 방법 개요
  **완료 조건:** 작업 완료의 정의 (Definition of Done)
  **의존성:** 선행/후행 작업

### ⚡ Epic (에픽)
형식:
- title: "[에픽] 대규모 기능명"
- description: |
  **비전:** 이 에픽이 달성하려는 목표
  **비즈니스 가치:** 예상되는 효과 및 KPI
  **범위:** 포함되는 주요 기능들
  **예상 기간:** 대략적인 소요 기간
  **관련 스토리:** 하위 스토리 목록

## 이슈 제안 형식
이슈를 제안할 때는 반드시 다음 형식을 사용하세요:

[ISSUE_SUGGESTION]
- type: epic/user_story/task/bug
- title: 이슈 제목 (위 베스트 프랙티스 형식 따름)
- description: |
  상세 설명 (마크다운 지원)
  여러 줄 가능
- priority: urgent/high/medium/low/none
- estimate: 1/2/3/5/8/13 (스토리 포인트, 선택)
- acceptance_criteria: |
  - [ ] Given... When... Then...
  - [ ] Given... When... Then...
  - [ ] Given... When... Then...
[/ISSUE_SUGGESTION]

## 검증 프로세스
복잡한 기능에 대해 이슈를 생성하기 전에, 사용자에게 핵심 사항을 Yes/No 질문으로 확인합니다:

예시:
"다음 내용이 맞는지 확인해주세요:
1. 로그인 기능에 소셜 로그인(Google)이 포함되나요? (Yes/No)
2. 이메일 인증이 필수인가요? (Yes/No)
3. 비밀번호 찾기 기능이 필요한가요? (Yes/No)"

확인 후 상세한 이슈를 생성합니다.

## 대화 시작 시
사용자가 기능이나 아이디어를 설명하면:
1. 핵심 요구사항 파악을 위한 명확화 질문 2-3개
2. 간단한 Yes/No 확인으로 범위 정의
3. 베스트 프랙티스 기반의 상세한 이슈 제안`;

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

