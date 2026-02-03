import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
};

const SYSTEM_PROMPT = `당신은 Lily AI입니다. 프로젝트 관리와 제품 개발을 돕는 AI 어시스턴트입니다.

주요 역할:
1. 프로젝트 아이디어 논의 및 구체화
2. PRD(제품 요구사항 문서) 작성 지원
3. 사용자 스토리 및 기술 스펙 작성
4. 개발 이슈/티켓 생성 제안
5. 기술적 질문에 대한 답변

답변 스타일:
- 한국어로 자연스럽게 대화
- 명확하고 구조화된 답변
- 필요시 마크다운 포맷 사용
- 실용적이고 실행 가능한 제안

이슈를 제안할 때는 다음 형식을 사용하세요:
[ISSUE_SUGGESTION]
- title: 이슈 제목
- description: 이슈 설명
- priority: urgent/high/medium/low/none
[/ISSUE_SUGGESTION]`;

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

// Call Anthropic API
async function callAnthropic(messages: ChatMessage[], apiKey: string, stream: boolean) {
  const response = await fetch(AI_PROVIDERS.anthropic.url, {
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
      messages: messages.filter(m => m.role !== "system").map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream,
    }),
  });

  return response;
}

// Call OpenAI API
async function callOpenAI(messages: ChatMessage[], apiKey: string, stream: boolean) {
  const response = await fetch(AI_PROVIDERS.openai.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.openai.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      stream,
    }),
  });

  return response;
}

// Call Gemini API
async function callGemini(messages: ChatMessage[], apiKey: string) {
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Add system prompt as first user message if not present
  if (messages[0]?.role !== "system") {
    contents.unshift({
      role: "user",
      parts: [{ text: `System: ${SYSTEM_PROMPT}` }],
    });
  }

  const response = await fetch(`${AI_PROVIDERS.gemini.url}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: 4096,
      },
    }),
  });

  return response;
}

// Call Lovable AI Gateway (default fallback)
async function callLovable(messages: ChatMessage[], apiKey: string, stream: boolean) {
  const response = await fetch(AI_PROVIDERS.lovable.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.lovable.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      stream,
    }),
  });

  return response;
}

// Auto-select best provider based on available keys and message content
function selectProvider(
  userSettings: { anthropic_api_key?: string; openai_api_key?: string; gemini_api_key?: string } | null,
  messageContent: string
): { provider: string; apiKey: string } {
  // Check which keys are available
  const hasAnthropic = !!userSettings?.anthropic_api_key;
  const hasOpenAI = !!userSettings?.openai_api_key;
  const hasGemini = !!userSettings?.gemini_api_key;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  // Simple heuristics for auto-selection
  const isCodeRelated = /코드|code|프로그래밍|개발|버그|에러|함수|API/i.test(messageContent);
  const isCreative = /아이디어|브레인스토밍|창의|디자인|기획/i.test(messageContent);
  const isAnalytical = /분석|데이터|통계|비교|평가/i.test(messageContent);

  // Priority: User's own keys first, then Lovable gateway
  if (isCodeRelated && hasAnthropic) {
    return { provider: "anthropic", apiKey: userSettings!.anthropic_api_key! };
  }
  
  if (isCreative && hasOpenAI) {
    return { provider: "openai", apiKey: userSettings!.openai_api_key! };
  }
  
  if (isAnalytical && hasGemini) {
    return { provider: "gemini", apiKey: userSettings!.gemini_api_key! };
  }

  // Default priority: Anthropic > OpenAI > Gemini > Lovable
  if (hasAnthropic) return { provider: "anthropic", apiKey: userSettings!.anthropic_api_key! };
  if (hasOpenAI) return { provider: "openai", apiKey: userSettings!.openai_api_key! };
  if (hasGemini) return { provider: "gemini", apiKey: userSettings!.gemini_api_key! };
  
  // Always fallback to Lovable AI Gateway (auto-provisioned key)
  if (lovableKey) {
    return { provider: "lovable", apiKey: lovableKey };
  }
  
  // Final fallback: return empty but let the edge function handle error gracefully
  return { provider: "lovable", apiKey: "" };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, provider = "auto", stream = true, conversationId, teamId } = await req.json() as RequestBody;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userSettings: { anthropic_api_key?: string; openai_api_key?: string; gemini_api_key?: string; default_provider?: string; auto_mode_enabled?: boolean } | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;

      // Get user's AI settings
      if (userId) {
        const { data: settings } = await supabase
          .from("user_ai_settings")
          .select("*")
          .eq("user_id", userId)
          .single();
        
        userSettings = settings;
      }
    }

    // Determine which provider to use
    let selectedProvider: string;
    let apiKey: string;

    if (provider === "auto" || (userSettings?.auto_mode_enabled && provider !== "lovable")) {
      const selection = selectProvider(userSettings, messages[messages.length - 1]?.content || "");
      selectedProvider = selection.provider;
      apiKey = selection.apiKey;
    } else if (provider === "anthropic" && userSettings?.anthropic_api_key) {
      selectedProvider = "anthropic";
      apiKey = userSettings.anthropic_api_key;
    } else if (provider === "openai" && userSettings?.openai_api_key) {
      selectedProvider = "openai";
      apiKey = userSettings.openai_api_key;
    } else if (provider === "gemini" && userSettings?.gemini_api_key) {
      selectedProvider = "gemini";
      apiKey = userSettings.gemini_api_key;
    } else {
      // Default to Lovable AI Gateway
      selectedProvider = "lovable";
      apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "No API key available for the selected provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the appropriate AI provider
    let response: Response;

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
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `AI provider error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For Gemini (non-streaming), transform response
    if (selectedProvider === "gemini") {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      return new Response(
        JSON.stringify({ 
          content: text,
          provider: selectedProvider,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For streaming responses, pass through
    if (stream) {
      return new Response(response.body, {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "text/event-stream",
          "X-AI-Provider": selectedProvider,
        },
      });
    }

    // Non-streaming response
    const data = await response.json();
    let content = "";

    if (selectedProvider === "anthropic") {
      content = data.content?.[0]?.text || "";
    } else {
      content = data.choices?.[0]?.message?.content || "";
    }

    return new Response(
      JSON.stringify({ 
        content,
        provider: selectedProvider,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
