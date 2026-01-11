import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get Google Gemini configuration
function getGeminiConfig() {
  const apiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  
  if (!apiKey) {
    console.error("GOOGLE_GEMINI_API_KEY not found in environment");
    return null;
  }
  
  return {
    apiKey,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    models: {
      fast: "gemini-2.0-flash",
      pro: "gemini-1.5-pro",
    },
  };
}

// Determine task type from messages
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

  // Document context
  if (lowerContent.includes("[document content]")) return "document";

  // Search context
  if (lowerContent.includes("[live search results]")) return "search";

  return "text";
}

// Convert OpenAI-style messages to Gemini format
function convertToGeminiFormat(messages: any[], systemPrompt: string) {
  const contents: any[] = [];
  
  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";
    
    if (typeof msg.content === "string") {
      contents.push({
        role,
        parts: [{ text: msg.content }]
      });
    } else if (Array.isArray(msg.content)) {
      const parts: any[] = [];
      
      for (const part of msg.content) {
        if (part.type === "text") {
          parts.push({ text: part.text });
        } else if (part.type === "image_url" && part.image_url?.url) {
          // Handle base64 images
          const url = part.image_url.url;
          if (url.startsWith("data:")) {
            const matches = url.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              parts.push({
                inline_data: {
                  mime_type: matches[1],
                  data: matches[2]
                }
              });
            }
          }
        }
      }
      
      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }
  }
  
  return {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    }
  };
}

// Make request with retry logic
async function makeGeminiRequest(
  config: NonNullable<ReturnType<typeof getGeminiConfig>>,
  model: string,
  requestBody: any
): Promise<{ success: boolean; text?: string; error?: string }> {
  const url = `${config.baseUrl}/${model}:generateContent?key=${config.apiKey}`;
  
  let lastError = "";
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Gemini API attempt ${attempt}/${MAX_RETRIES} with model: ${model}`);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (response.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
          console.log(`Success on attempt ${attempt}`);
          return { success: true, text };
        }
        
        // Handle blocked content
        if (data.candidates?.[0]?.finishReason === "SAFETY") {
          console.log("Content blocked by safety filters");
          return { success: true, text: "I can't respond to that request due to content guidelines." };
        }
        
        console.error("No text in response:", JSON.stringify(data).slice(0, 500));
        lastError = "No content in response";
        continue;
      }

      const status = response.status;
      console.error(`Attempt ${attempt} failed:`, status, JSON.stringify(data).slice(0, 500));

      // Rate limit - wait longer
      if (status === 429) {
        console.log("Rate limited, waiting before retry...");
        await sleep(RETRY_DELAY_MS * attempt * 2);
        lastError = "Rate limited";
        continue;
      }

      // Server error - retry
      if (status >= 500) {
        await sleep(RETRY_DELAY_MS * attempt);
        lastError = `Server error: ${status}`;
        continue;
      }

      // Client error - check for specific issues
      if (status === 400) {
        const errorMessage = data.error?.message || "Bad request";
        console.error("Bad request error:", errorMessage);
        lastError = errorMessage;
        break; // Don't retry bad requests
      }

      if (status === 401 || status === 403) {
        console.error("Authentication error - check API key");
        lastError = "API key issue";
        break;
      }

      lastError = `API error: ${status}`;
      
    } catch (err) {
      console.error(`Attempt ${attempt} network error:`, err);
      lastError = err instanceof Error ? err.message : String(err);
      
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  return { success: false, error: lastError };
}

// Create SSE response for streaming to frontend
function createSSEResponse(content: string, corsHeaders: Record<string, string>): Response {
  const encoder = new TextEncoder();
  const data = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "gemini",
    choices: [{
      index: 0,
      delta: { content },
      finish_reason: "stop"
    }]
  };
  
  const sseMessage = `data: ${JSON.stringify(data)}\n\ndata: [DONE]\n\n`;
  
  return new Response(encoder.encode(sseMessage), {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
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
      userName: userName || "not set",
      userStyle: userStyle || "balanced"
    });

    // Get Gemini config
    const config = getGeminiConfig();
    
    if (!config) {
      console.error("Gemini API key not configured");
      return createSSEResponse(
        "I'm currently being set up. Please ensure the Google AI Studio API key is configured in the project secrets.",
        corsHeaders
      );
    }

    // Detect task type and select model
    const taskType = detectTaskType(messages);
    const model = taskType === "reasoning" || taskType === "document" 
      ? config.models.pro 
      : config.models.fast;
    
    console.log(`Task type: ${taskType}, Model: ${model}`);

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
      friendly: 'Be warm, friendly, and casual.',
      professional: 'Be formal and professional.',
      concise: 'Be brief and to the point.',
      detailed: 'Be thorough and comprehensive.',
    };

    const userGreeting = userName ? `The user's name is ${userName}.` : '';
    const styleGuide = styleInstructions[userStyle || 'balanced'] || styleInstructions.balanced;

    const systemPrompt = `You are Delton 2.0, an advanced multimodal AI agent created by Yogesh GR from Google and launched in 2025. ${styleGuide} ${userGreeting}

IDENTITY:
When asked who created you, respond: "I'm Delton 2.0, created by Yogesh GR from Google, launched in 2025."

CURRENT CONTEXT:
- Current Date: ${currentDate}
- Current Time: ${currentTime}

CAPABILITIES:
1. Vision & Image Understanding
2. Web Search (when results are provided in context)
3. Document Analysis
4. Code Interpretation
5. Long-Term Memory

GUIDELINES:
- Be confident and accurate
- Use formatting for readability
- Never fabricate information
- Use context provided (search results, documents, memories)

REMINDER FORMAT (when user asks for reminders):
[REMINDER: title="what" time="ISO datetime"]`;

    // Filter out personalization messages
    const filteredMessages = messages.filter((m: any) => 
      !(m.role === 'system' && (m.content?.startsWith?.('USER_NAME:') || m.content?.startsWith?.('USER_STYLE:')))
    );

    // Convert to Gemini format
    const requestBody = convertToGeminiFormat(filteredMessages, systemPrompt);

    // Make request
    const result = await makeGeminiRequest(config, model, requestBody);

    if (result.success && result.text) {
      return createSSEResponse(result.text, corsHeaders);
    }

    // Fallback response on failure
    console.error("Gemini request failed:", result.error);
    return createSSEResponse(
      "I'm processing your request. Please try again in a moment.",
      corsHeaders
    );

  } catch (error) {
    console.error("Unified AI error:", error);
    return createSSEResponse(
      "I encountered an issue. Please try your question again.",
      corsHeaders
    );
  }
});
