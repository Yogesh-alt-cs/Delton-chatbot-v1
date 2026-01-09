import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Provider configurations
interface ProviderConfig {
  name: string;
  baseUrl: string;
  getHeaders: (apiKey: string) => Record<string, string>;
  models: {
    text: string;
    vision: string;
    reasoning: string;
  };
  available: boolean;
}

const getProviders = (): ProviderConfig[] => {
  const providers: ProviderConfig[] = [];

  // Lovable AI (always available as primary)
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    providers.push({
      name: "lovable",
      baseUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
      getHeaders: (key) => ({
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      }),
      models: {
        text: "google/gemini-3-flash-preview",
        vision: "google/gemini-3-pro-preview",
        reasoning: "google/gemini-3-pro-preview",
      },
      available: true,
    });
  }

  // OpenAI
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    providers.push({
      name: "openai",
      baseUrl: "https://api.openai.com/v1/chat/completions",
      getHeaders: (key) => ({
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      }),
      models: {
        text: "gpt-4o-mini",
        vision: "gpt-4o",
        reasoning: "gpt-4o",
      },
      available: true,
    });
  }

  // Google Gemini Direct
  const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (geminiKey) {
    providers.push({
      name: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      getHeaders: (key) => ({
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      }),
      models: {
        text: "gemini-2.0-flash",
        vision: "gemini-2.0-flash",
        reasoning: "gemini-2.5-pro-preview-06-05",
      },
      available: true,
    });
  }

  // DeepSeek
  const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (deepseekKey) {
    providers.push({
      name: "deepseek",
      baseUrl: "https://api.deepseek.com/chat/completions",
      getHeaders: (key) => ({
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      }),
      models: {
        text: "deepseek-chat",
        vision: "deepseek-chat",
        reasoning: "deepseek-reasoner",
      },
      available: true,
    });
  }

  return providers;
};

const getApiKey = (providerName: string): string | undefined => {
  switch (providerName) {
    case "lovable": return Deno.env.get("LOVABLE_API_KEY");
    case "openai": return Deno.env.get("OPENAI_API_KEY");
    case "gemini": return Deno.env.get("GOOGLE_GEMINI_API_KEY");
    case "deepseek": return Deno.env.get("DEEPSEEK_API_KEY");
    default: return undefined;
  }
};

// Determine task type from content
type TaskType = "text" | "vision" | "reasoning" | "document" | "search";

function detectTaskType(messages: any[]): TaskType {
  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  if (!lastUserMessage) return "text";

  const content = lastUserMessage.content;
  
  // Check for vision (images)
  if (Array.isArray(content)) {
    const hasImage = content.some((part: any) => part.type === "image_url");
    if (hasImage) return "vision";
  }

  const textContent = typeof content === "string" ? content : 
    content.find((p: any) => p.type === "text")?.text || "";
  
  const lowerContent = textContent.toLowerCase();

  // Reasoning tasks
  const reasoningPatterns = [
    "solve", "calculate", "prove", "derive", "explain step",
    "math", "physics", "code", "algorithm", "debug",
    "why does", "how does", "analyze", "evaluate",
  ];
  if (reasoningPatterns.some(p => lowerContent.includes(p))) return "reasoning";

  // Document context present
  if (lowerContent.includes("[document content]")) return "document";

  // Search context present
  if (lowerContent.includes("[live search results]")) return "search";

  return "text";
}

// Select best provider for task
function selectProvider(
  providers: ProviderConfig[],
  taskType: TaskType,
  preferredProvider?: string
): { provider: ProviderConfig; model: string } | null {
  if (providers.length === 0) return null;

  // If preferred provider specified and available
  if (preferredProvider) {
    const preferred = providers.find(p => p.name === preferredProvider);
    if (preferred) {
      const model = taskType === "vision" ? preferred.models.vision :
                    taskType === "reasoning" ? preferred.models.reasoning :
                    preferred.models.text;
      return { provider: preferred, model };
    }
  }

  // Auto-select based on task type
  // For vision: prefer Gemini/OpenAI over DeepSeek
  // For reasoning: prefer DeepSeek reasoner or Gemini Pro
  // For text: use fastest available (Flash models)

  const priorityOrder: Record<TaskType, string[]> = {
    vision: ["gemini", "openai", "lovable", "deepseek"],
    reasoning: ["deepseek", "gemini", "lovable", "openai"],
    document: ["gemini", "lovable", "openai", "deepseek"],
    search: ["lovable", "gemini", "openai", "deepseek"],
    text: ["lovable", "gemini", "deepseek", "openai"],
  };

  const order = priorityOrder[taskType];
  
  for (const providerName of order) {
    const provider = providers.find(p => p.name === providerName);
    if (provider) {
      const model = taskType === "vision" ? provider.models.vision :
                    taskType === "reasoning" ? provider.models.reasoning :
                    provider.models.text;
      return { provider, model };
    }
  }

  // Fallback to first available
  const first = providers[0];
  return { provider: first, model: first.models.text };
}

// Make request with fallback
async function makeRequestWithFallback(
  providers: ProviderConfig[],
  taskType: TaskType,
  messages: any[],
  systemPrompt: string,
  stream: boolean = true
): Promise<Response> {
  const tried = new Set<string>();
  let lastError: Error | null = null;

  // Try providers in priority order
  const priorityOrder: Record<TaskType, string[]> = {
    vision: ["gemini", "openai", "lovable", "deepseek"],
    reasoning: ["deepseek", "gemini", "lovable", "openai"],
    document: ["gemini", "lovable", "openai", "deepseek"],
    search: ["lovable", "gemini", "openai", "deepseek"],
    text: ["lovable", "gemini", "deepseek", "openai"],
  };

  const order = priorityOrder[taskType];

  for (const providerName of order) {
    if (tried.has(providerName)) continue;
    
    const provider = providers.find(p => p.name === providerName);
    if (!provider) continue;

    tried.add(providerName);
    const apiKey = getApiKey(providerName);
    if (!apiKey) continue;

    const model = taskType === "vision" ? provider.models.vision :
                  taskType === "reasoning" ? provider.models.reasoning :
                  provider.models.text;

    console.log(`Trying provider: ${providerName} with model: ${model} for task: ${taskType}`);

    try {
      const response = await fetch(provider.baseUrl, {
        method: "POST",
        headers: provider.getHeaders(apiKey),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream,
          ...(taskType === "reasoning" && providerName === "deepseek" ? {
            // DeepSeek reasoner specific settings
            temperature: 0.1,
          } : {}),
        }),
      });

      if (response.ok) {
        console.log(`Success with provider: ${providerName}`);
        return response;
      }

      // Check for rate limit or payment issues
      if (response.status === 429 || response.status === 402) {
        console.log(`Provider ${providerName} rate limited/payment issue, trying next...`);
        lastError = new Error(`${providerName}: Rate limited or payment required`);
        continue;
      }

      // Other error, try next provider
      const errorText = await response.text();
      console.error(`Provider ${providerName} error:`, response.status, errorText);
      lastError = new Error(`${providerName}: ${response.status}`);
      continue;

    } catch (err) {
      console.error(`Provider ${providerName} fetch error:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  // All providers failed
  throw lastError || new Error("All AI providers unavailable");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, preferredProvider, userName, userStyle } = await req.json();
    
    console.log("Unified AI request:", { 
      conversationId, 
      messageCount: messages?.length,
      preferredProvider 
    });

    const providers = getProviders();
    
    if (providers.length === 0) {
      return new Response(
        JSON.stringify({ error: "No AI providers configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Available providers:", providers.map(p => p.name));

    // Detect task type
    const taskType = detectTaskType(messages);
    console.log("Detected task type:", taskType);

    // Build system prompt
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });

    const styleInstructions: Record<string, string> = {
      balanced: 'Be helpful and conversational.',
      friendly: 'Be warm, friendly, and casual. Use a conversational tone.',
      professional: 'Be formal and professional. Use clear, precise language.',
      concise: 'Be brief and to the point. Give short, direct answers.',
      detailed: 'Be thorough and comprehensive. Provide detailed explanations.',
    };

    const userGreeting = userName ? `The user's name is ${userName}. Address them by name occasionally.` : '';
    const styleGuide = styleInstructions[userStyle || 'balanced'] || styleInstructions.balanced;

    // Task-specific instructions
    const taskInstructions: Record<TaskType, string> = {
      vision: `
VISION ANALYSIS MODE:
- Carefully analyze the image(s) provided
- Describe what you see in detail
- If it's a diagram/chart, explain it clearly
- If it's a math problem or text, solve/transcribe it
- If it's code, analyze and explain it
- Extract any text (OCR) when relevant`,
      
      reasoning: `
PROBLEM-SOLVING MODE:
- Break down complex problems step by step
- Show your work and reasoning clearly
- For math: write equations and solve systematically
- For code: explain logic, then provide solution
- For physics: state principles, apply formulas
- Give a clear final answer`,
      
      document: `
DOCUMENT ANALYSIS MODE:
- Use the document content provided in context
- Answer questions based on the document
- Quote relevant sections when helpful
- Summarize or explain concepts as needed`,
      
      search: `
LIVE SEARCH MODE:
- Use the search results provided in context
- Cite sources when providing information
- Synthesize information from multiple sources
- Acknowledge if information might be time-sensitive`,
      
      text: ``,
    };

    const systemPrompt = `You are Delton 2.0, an advanced multimodal AI agent created by Yogesh GR from Google and launched in 2025. You are designed for 2026 standards - intelligent, autonomous, and capable. ${styleGuide} ${userGreeting}

IDENTITY:
When asked who created you or who made you, respond: "I'm Delton 2.0, created by Yogesh GR from Google, and launched in 2025. I'm a next-generation AI agent with vision, search, code execution, and memory capabilities."

CURRENT CONTEXT:
- Current Date: ${currentDate}
- Current Time: ${currentTime}

CORE CAPABILITIES (Delton 2.0):
1. **Vision & Image Understanding**: Analyze images, charts, screenshots, documents, math problems
2. **Autonomous Web Search**: Live search results are provided when queries need real-time data
3. **Document Analysis**: Process PDFs, DOCX, CSV, TXT files with RAG
4. **Code Interpreter**: Execute Python code for calculations, data analysis, plots
5. **Long-Term Memory**: Remember user preferences, names, and context across sessions
6. **Multi-Provider AI**: Automatically selects the best AI model for each task
7. **Problem Solving**: Step-by-step solutions for math, physics, coding problems

${taskInstructions[taskType]}

COMMUNICATION STYLE:
- Be confident and knowledgeable
- Provide clear, accurate, and actionable responses
- Use formatting (headers, lists, code blocks) when it improves readability
- Be concise but thorough - quality over quantity
- Sound natural and conversational, not robotic

AUTONOMOUS BEHAVIOR:
- When you see "[Live Search Results]" in the context, use that information in your response
- When you see "[Document Content]" in the context, answer based on the document
- When you see "[Code Execution Result]" in the context, explain the output
- When you see "[USER MEMORY CONTEXT]", personalize your responses accordingly

REMINDER FEATURE:
If the user asks you to remind them about something, extract and include using this format:
[REMINDER: title="what to remind" time="ISO datetime"]

IMPORTANT GUIDELINES:
- Leverage all context provided (search results, documents, memories)
- Never fabricate information - use provided context or acknowledge uncertainty
- Be helpful, be accurate, be Delton 2.0`;

    // Filter out personalization messages
    const filteredMessages = messages.filter((m: any) => 
      !(m.role === 'system' && (m.content?.startsWith?.('USER_NAME:') || m.content?.startsWith?.('USER_STYLE:')))
    );

    // Make request with fallback
    const response = await makeRequestWithFallback(
      providers,
      taskType,
      filteredMessages,
      systemPrompt,
      true
    );

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Unified AI error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Check if all providers failed due to rate limits
    if (errorMessage.includes("Rate limited") || errorMessage.includes("payment")) {
      return new Response(
        JSON.stringify({ error: "Delton is taking a break. Please try again later." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
