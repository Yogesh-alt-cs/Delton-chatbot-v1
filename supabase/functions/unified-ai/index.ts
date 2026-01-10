import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get Google Gemini configuration (primary and only provider)
function getGeminiConfig() {
  const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  
  if (geminiKey) {
    return {
      name: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: geminiKey,
      headers: {
        Authorization: `Bearer ${geminiKey}`,
        "Content-Type": "application/json",
      },
      models: {
        fast: "gemini-2.0-flash",
        pro: "gemini-2.5-pro-preview-06-05",
        vision: "gemini-2.0-flash",
      },
    };
  }
  
  return null;
}

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

// Select model based on task type
function selectModel(config: ReturnType<typeof getGeminiConfig>, taskType: TaskType): string {
  if (!config) return "gemini-2.0-flash";
  
  switch (taskType) {
    case "vision":
      return config.models.vision;
    case "reasoning":
      return config.models.pro;
    case "document":
      return config.models.pro;
    default:
      return config.models.fast;
  }
}

// Make request with retry logic
async function makeRequestWithRetry(
  config: NonNullable<ReturnType<typeof getGeminiConfig>>,
  model: string,
  messages: any[],
  systemPrompt: string,
  stream: boolean = true
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${MAX_RETRIES} with model: ${model}`);
      
      const response = await fetch(config.baseUrl, {
        method: "POST",
        headers: config.headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream,
        }),
      });

      if (response.ok) {
        console.log(`Success on attempt ${attempt}`);
        return response;
      }

      // Handle specific error codes
      const status = response.status;
      const errorText = await response.text();
      console.error(`Attempt ${attempt} failed:`, status, errorText);

      // Rate limit - wait longer before retry
      if (status === 429) {
        console.log("Rate limited, waiting before retry...");
        await sleep(RETRY_DELAY_MS * attempt * 2);
        lastError = new Error("Rate limited");
        continue;
      }

      // Server error - retry
      if (status >= 500) {
        await sleep(RETRY_DELAY_MS * attempt);
        lastError = new Error(`Server error: ${status}`);
        continue;
      }

      // Client error (400, 401, 403, etc.) - don't retry, throw immediately
      if (status >= 400 && status < 500) {
        throw new Error(`API error: ${status}`);
      }

      lastError = new Error(`Unexpected status: ${status}`);
      
    } catch (err) {
      console.error(`Attempt ${attempt} error:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError || new Error("Request failed after all retries");
}

// Generate a graceful fallback response
function generateFallbackResponse(): Response {
  const fallbackMessage = {
    id: "fallback",
    object: "chat.completion",
    created: Date.now(),
    model: "fallback",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: "I'm processing your request. Please give me a moment and try again. If this persists, there might be a temporary service issue."
      },
      finish_reason: "stop"
    }]
  };

  return new Response(
    JSON.stringify(fallbackMessage),
    { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, userName, userStyle } = await req.json();
    
    console.log("Unified AI request:", { 
      conversationId, 
      messageCount: messages?.length,
    });

    // Get Google Gemini config (only provider)
    const geminiConfig = getGeminiConfig();
    
    if (!geminiConfig) {
      console.error("GOOGLE_GEMINI_API_KEY not configured");
      // Return graceful fallback instead of error
      return new Response(
        JSON.stringify({
          choices: [{
            message: {
              role: "assistant",
              content: "I'm currently being set up. Please ensure the Google AI Studio API key is configured."
            }
          }]
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect task type
    const taskType = detectTaskType(messages);
    console.log("Detected task type:", taskType);

    // Select appropriate model
    const model = selectModel(geminiConfig, taskType);
    console.log("Selected model:", model);

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
6. **Problem Solving**: Step-by-step solutions for math, physics, coding problems

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

    try {
      // Make request with retry logic
      const response = await makeRequestWithRetry(
        geminiConfig,
        model,
        filteredMessages,
        systemPrompt,
        true
      );

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    } catch (apiError) {
      console.error("API request failed after retries:", apiError);
      
      // Return graceful fallback response instead of error
      const fallbackContent = "I encountered a temporary issue while processing your request. Please try again in a moment.";
      
      // Create a simple SSE response with the fallback message
      const encoder = new TextEncoder();
      const fallbackData = {
        id: "fallback",
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "fallback",
        choices: [{
          index: 0,
          delta: { content: fallbackContent },
          finish_reason: "stop"
        }]
      };
      
      const sseMessage = `data: ${JSON.stringify(fallbackData)}\n\ndata: [DONE]\n\n`;
      
      return new Response(encoder.encode(sseMessage), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

  } catch (error) {
    console.error("Unified AI error:", error);
    
    // Always return a graceful response, never expose errors
    const encoder = new TextEncoder();
    const fallbackData = {
      id: "error-fallback",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: "fallback",
      choices: [{
        index: 0,
        delta: { content: "I'm having a moment. Please try your question again." },
        finish_reason: "stop"
      }]
    };
    
    const sseMessage = `data: ${JSON.stringify(fallbackData)}\n\ndata: [DONE]\n\n`;
    
    return new Response(encoder.encode(sseMessage), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  }
});
