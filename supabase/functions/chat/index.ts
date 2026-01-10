import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get Google Gemini configuration (primary provider)
function getGeminiConfig() {
  const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  
  if (geminiKey) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      headers: {
        Authorization: `Bearer ${geminiKey}`,
        "Content-Type": "application/json",
      },
      model: "gemini-2.0-flash",
    };
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId } = await req.json();
    
    console.log("Chat request received:", { conversationId, messageCount: messages?.length });

    const config = getGeminiConfig();
    if (!config) {
      console.error("GOOGLE_GEMINI_API_KEY is not configured");
      
      // Return graceful fallback
      const encoder = new TextEncoder();
      const fallbackData = {
        id: "config-fallback",
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "fallback",
        choices: [{
          index: 0,
          delta: { content: "I'm being set up. Please ensure the Google AI Studio API key is configured." },
          finish_reason: "stop"
        }]
      };
      
      const sseMessage = `data: ${JSON.stringify(fallbackData)}\n\ndata: [DONE]\n\n`;
      
      return new Response(encoder.encode(sseMessage), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Get current date for context
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // Get personalization from request if provided
    const userName = messages.find((m: any) => m.role === 'system' && m.content?.startsWith('USER_NAME:'))?.content?.replace('USER_NAME:', '').trim() || '';
    const userStyle = messages.find((m: any) => m.role === 'system' && m.content?.startsWith('USER_STYLE:'))?.content?.replace('USER_STYLE:', '').trim() || 'balanced';
    
    // Filter out personalization messages from actual messages
    const filteredMessages = messages.filter((m: any) => 
      !(m.role === 'system' && (m.content?.startsWith('USER_NAME:') || m.content?.startsWith('USER_STYLE:')))
    );

    // Style instructions based on preference
    const styleInstructions: Record<string, string> = {
      balanced: 'Be helpful and conversational.',
      friendly: 'Be warm, friendly, and casual. Use a conversational tone with occasional humor.',
      professional: 'Be formal and professional. Use clear, precise language.',
      concise: 'Be brief and to the point. Give short, direct answers.',
      detailed: 'Be thorough and comprehensive. Provide detailed explanations with examples.',
    };

    const userGreeting = userName ? `The user's name is ${userName}. Address them by name occasionally.` : '';
    const styleGuide = styleInstructions[userStyle] || styleInstructions.balanced;

    const systemPrompt = `You are Delton 2.0, an advanced multimodal AI agent created by Yogesh GR from Google and launched in 2025. You are designed for 2026 standards - intelligent, autonomous, and capable. ${styleGuide} ${userGreeting}

IDENTITY:
When asked who created you or who made you, respond: "I'm Delton 2.0, created by Yogesh GR from Google, and launched in 2025. I'm a next-generation AI agent with vision, search, code execution, and memory capabilities."

CURRENT CONTEXT:
- Current Date: ${currentDate}
- Current Time: ${currentTime}

CORE CAPABILITIES (Delton 2.0):
1. **Vision & Image Understanding**: Analyze images, charts, screenshots, documents
2. **Autonomous Web Search**: Live search results are provided when queries need real-time data
3. **Document Analysis**: Process PDFs, DOCX, CSV, TXT files with RAG
4. **Code Interpreter**: Execute Python code for calculations, data analysis, plots
5. **Long-Term Memory**: Remember user preferences, names, and context across sessions
6. **URL Extraction**: Automatically scrape and understand linked content

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
If the user asks you to remind them about something, extract and include the reminder using this EXACT format:
[REMINDER: title="what to remind" time="ISO datetime"]

IMPORTANT GUIDELINES:
- Leverage all context provided (search results, documents, memories)
- Never fabricate information - use provided context or acknowledge uncertainty
- Be helpful, be accurate, be Delton 2.0`;

    // Retry logic
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Chat attempt ${attempt}/${MAX_RETRIES}`);
        
        const response = await fetch(config.url, {
          method: "POST",
          headers: config.headers,
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: "system", content: systemPrompt },
              ...filteredMessages,
            ],
            stream: true,
          }),
        });

        if (response.ok) {
          console.log("Streaming response started");
          return new Response(response.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }

        const status = response.status;
        const errorText = await response.text();
        console.error(`Chat attempt ${attempt} failed:`, status, errorText);

        if (status === 429) {
          await sleep(RETRY_DELAY_MS * attempt * 2);
          lastError = new Error("Rate limited");
          continue;
        }

        if (status >= 500) {
          await sleep(RETRY_DELAY_MS * attempt);
          lastError = new Error(`Server error: ${status}`);
          continue;
        }

        lastError = new Error(`API error: ${status}`);
        break;

      } catch (err) {
        console.error(`Chat attempt ${attempt} error:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
        
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    // Graceful fallback response
    console.error("All attempts failed, returning fallback");
    const encoder = new TextEncoder();
    const fallbackData = {
      id: "fallback",
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

  } catch (error) {
    console.error("Chat function error:", error);
    
    // Always return graceful response
    const encoder = new TextEncoder();
    const fallbackData = {
      id: "error-fallback",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: "fallback",
      choices: [{
        index: 0,
        delta: { content: "I encountered a hiccup. Please try again." },
        finish_reason: "stop"
      }]
    };
    
    const sseMessage = `data: ${JSON.stringify(fallbackData)}\n\ndata: [DONE]\n\n`;
    
    return new Response(encoder.encode(sseMessage), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  }
});
