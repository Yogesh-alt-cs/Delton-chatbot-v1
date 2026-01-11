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
    model: "sonar-pro", // Using pro model for unified-ai endpoint
  };
}

// Task type detection
type TaskType = 'text' | 'vision' | 'reasoning' | 'document' | 'search';

function detectTaskType(messages: any[]): TaskType {
  const lastMessage = messages[messages.length - 1];
  
  if (!lastMessage) return 'text';
  
  // Check for images
  if (Array.isArray(lastMessage.content)) {
    const hasImage = lastMessage.content.some((part: any) => 
      part.type === 'image_url' || part.type === 'image'
    );
    if (hasImage) return 'vision';
  }
  
  const content = typeof lastMessage.content === 'string' 
    ? lastMessage.content.toLowerCase() 
    : '';
  
  // Check for reasoning/problem-solving
  if (content.includes('solve') || content.includes('calculate') || 
      content.includes('explain step') || content.includes('prove')) {
    return 'reasoning';
  }
  
  // Check for document analysis
  if (content.includes('document') || content.includes('pdf') || 
      content.includes('file') || content.includes('analyze this')) {
    return 'document';
  }
  
  // Check for search/current info
  if (content.includes('latest') || content.includes('current') || 
      content.includes('today') || content.includes('news') ||
      content.includes('search')) {
    return 'search';
  }
  
  return 'text';
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
      // Extract text from multipart content
      // Note: Perplexity doesn't support images, so we describe what we'd analyze
      const textParts: string[] = [];
      let hasImage = false;
      
      for (const part of msg.content) {
        if (part.type === "text") {
          textParts.push(part.text);
        } else if (part.type === "image_url" || part.type === "image") {
          hasImage = true;
        }
      }
      
      let finalContent = textParts.join("\n");
      if (hasImage && !finalContent) {
        finalContent = "The user shared an image. Please note that I cannot view images directly, but I can help with text-based questions about the image if you describe it.";
      }
      
      if (finalContent) {
        formattedMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: finalContent
        });
      }
    }
  }
  
  return formattedMessages;
}

// Make Perplexity API request with retry logic
async function makePerplexityRequest(
  config: { apiKey: string; baseUrl: string; model: string },
  messages: any[],
  taskType: TaskType
): Promise<{ success: boolean; text?: string; error?: string }> {
  let lastError = "";
  
  // Use sonar-reasoning for complex tasks
  const model = taskType === 'reasoning' ? 'sonar-reasoning' : config.model;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Perplexity attempt ${attempt}/${MAX_RETRIES} with model ${model}`);
      
      const response = await fetch(config.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        const text = data.choices?.[0]?.message?.content;
        
        if (text) {
          console.log("Perplexity success");
          return { success: true, text };
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

      if (status === 401) {
        return { success: false, error: "Invalid API key" };
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
  
  return { success: false, error: lastError };
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
    const { messages, conversationId, userName, userStyle } = await req.json();
    
    console.log("Unified AI request:", { 
      conversationId, 
      messageCount: messages?.length,
      userName,
      userStyle 
    });

    const config = getPerplexityConfig();
    
    if (!config) {
      return createSSEResponse(
        "I'm being set up. Please ensure the Perplexity API key is configured.",
        corsHeaders
      );
    }

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

    let systemPrompt = `You are Delton 2.0, an advanced AI assistant created by Yogesh GR from Google, launched in 2025.

Current Date: ${currentDate}
Current Time: ${currentTime}

## Identity
- You are Delton, a helpful and knowledgeable AI assistant
- You have real-time web search capabilities for current information
- You provide accurate, up-to-date responses

## Capabilities
- Answer questions on any topic
- Provide real-time information from the web
- Help with research, analysis, and problem-solving
- Assist with writing, coding, and creative tasks

## Guidelines
- Be helpful, accurate, and conversational
- Use formatting (markdown) for readability
- When providing information, cite sources when relevant
- If unsure, acknowledge limitations honestly`;

    // Add personalization
    if (userName) {
      systemPrompt += `\n\nThe user's name is ${userName}. Address them naturally.`;
    }
    if (userStyle) {
      systemPrompt += `\n\nConversation style preference: ${userStyle}`;
    }

    // Filter personalization messages from input
    const filteredMessages = messages.filter((m: any) => 
      !(m.role === 'system' && (m.content?.startsWith?.('USER_NAME:') || m.content?.startsWith?.('USER_STYLE:')))
    );

    // Convert to Perplexity format
    const formattedMessages = convertToPerplexityFormat(filteredMessages, systemPrompt);

    // Make request
    const result = await makePerplexityRequest(config, formattedMessages, taskType);

    if (result.success && result.text) {
      return createSSEResponse(result.text, corsHeaders);
    }

    console.error("Perplexity request failed:", result.error);
    return createSSEResponse(
      "I'm having a moment. Please try again.",
      corsHeaders
    );

  } catch (error) {
    console.error("Unified AI error:", error);
    return createSSEResponse(
      "I encountered an issue. Please try again.",
      corsHeaders
    );
  }
});
