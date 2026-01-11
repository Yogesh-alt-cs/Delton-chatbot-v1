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
    console.error("GOOGLE_GEMINI_API_KEY not found");
    return null;
  }
  
  return {
    apiKey,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    model: "gemini-2.0-flash",
  };
}

// Convert messages to Gemini format
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

// Create SSE response
function createSSEResponse(content: string, headers: Record<string, string>): Response {
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
    headers: { ...headers, "Content-Type": "text/event-stream" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId } = await req.json();
    
    console.log("Chat request:", { conversationId, messageCount: messages?.length });

    const config = getGeminiConfig();
    
    if (!config) {
      return createSSEResponse(
        "I'm being set up. Please ensure the Google AI Studio API key is configured.",
        corsHeaders
      );
    }

    // Build system prompt
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });

    const systemPrompt = `You are Delton 2.0, an advanced AI assistant created by Yogesh GR from Google, launched in 2025.

Current Date: ${currentDate}
Current Time: ${currentTime}

Be helpful, accurate, and conversational. Use formatting for readability.`;

    // Filter personalization messages
    const filteredMessages = messages.filter((m: any) => 
      !(m.role === 'system' && (m.content?.startsWith?.('USER_NAME:') || m.content?.startsWith?.('USER_STYLE:')))
    );

    const requestBody = convertToGeminiFormat(filteredMessages, systemPrompt);
    const url = `${config.baseUrl}/${config.model}:generateContent?key=${config.apiKey}`;

    let lastError = "";
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Chat attempt ${attempt}/${MAX_RETRIES}`);
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        
        if (response.ok) {
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (text) {
            console.log("Chat success");
            return createSSEResponse(text, corsHeaders);
          }
          
          if (data.candidates?.[0]?.finishReason === "SAFETY") {
            return createSSEResponse(
              "I can't respond to that due to content guidelines.",
              corsHeaders
            );
          }
          
          lastError = "No content in response";
          continue;
        }

        const status = response.status;
        console.error(`Attempt ${attempt} failed:`, status);

        if (status === 429) {
          await sleep(RETRY_DELAY_MS * attempt * 2);
          lastError = "Rate limited";
          continue;
        }

        if (status >= 500) {
          await sleep(RETRY_DELAY_MS * attempt);
          lastError = `Server error: ${status}`;
          continue;
        }

        lastError = `API error: ${status}`;
        break;
        
      } catch (err) {
        console.error(`Attempt ${attempt} error:`, err);
        lastError = err instanceof Error ? err.message : String(err);
        
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    console.error("All attempts failed:", lastError);
    return createSSEResponse(
      "I'm having a moment. Please try again.",
      corsHeaders
    );

  } catch (error) {
    console.error("Chat error:", error);
    return createSSEResponse(
      "I encountered an issue. Please try again.",
      corsHeaders
    );
  }
});
