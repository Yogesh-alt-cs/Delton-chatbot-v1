import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get Perplexity configuration
function getPerplexityConfig() {
  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  
  if (!apiKey) {
    console.error("PERPLEXITY_API_KEY not found");
    return null;
  }
  
  return {
    apiKey,
    baseUrl: "https://api.perplexity.ai/chat/completions",
    model: "sonar",
  };
}

// Convert messages to Perplexity format
function convertToPerplexityFormat(messages: any[], systemPrompt: string) {
  const formattedMessages: any[] = [
    { role: "system", content: systemPrompt }
  ];
  
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      formattedMessages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content
      });
    } else if (Array.isArray(msg.content)) {
      // Extract text from multipart content (Perplexity doesn't support images)
      const textParts = msg.content
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .join("\n");
      
      if (textParts) {
        formattedMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: textParts
        });
      }
    }
  }
  
  return formattedMessages;
}

// Create SSE response
function createSSEResponse(content: string, headers: Record<string, string>): Response {
  const encoder = new TextEncoder();
  const data = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "perplexity",
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

    const config = getPerplexityConfig();
    
    if (!config) {
      return createSSEResponse(
        "I'm being set up. Please ensure the Perplexity API key is configured.",
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

    const formattedMessages = convertToPerplexityFormat(filteredMessages, systemPrompt);

    let lastError = "";
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Chat attempt ${attempt}/${MAX_RETRIES}`);
        
        const response = await fetch(config.baseUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: config.model,
            messages: formattedMessages,
            temperature: 0.7,
            max_tokens: 4096,
          }),
        });

        const data = await response.json();
        
        if (response.ok) {
          const text = data.choices?.[0]?.message?.content;
          
          if (text) {
            console.log("Chat success");
            return createSSEResponse(text, corsHeaders);
          }
          
          lastError = "No content in response";
          continue;
        }

        const status = response.status;
        console.error(`Attempt ${attempt} failed:`, status, data);

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

        lastError = `API error: ${status} - ${JSON.stringify(data)}`;
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
