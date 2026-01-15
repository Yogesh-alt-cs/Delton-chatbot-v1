import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get Llama 4 Scout configuration via GitHub AI Models
function getLlamaConfig() {
  const githubToken = Deno.env.get("GITHUB_TOKEN");
  
  if (!githubToken) {
    console.error("GITHUB_TOKEN not found");
    return null;
  }
  
  return {
    apiKey: githubToken,
    baseUrl: "https://models.github.ai/inference/chat/completions",
    model: "meta/llama-4-scout-17b-16e-instruct",
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

// Convert messages to OpenAI-compatible format for Llama
function convertToLlamaFormat(messages: any[], systemPrompt: string) {
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
      // Handle multipart content (text + images)
      const parts: any[] = [];
      
      for (const part of msg.content) {
        if (part.type === "text") {
          parts.push({ type: "text", text: part.text });
        } else if (part.type === "image_url" || part.type === "image") {
          // Llama 4 Scout supports vision
          const imageUrl = part.image_url?.url || part.url || part.image;
          if (imageUrl) {
            parts.push({
              type: "image_url",
              image_url: { url: imageUrl }
            });
          }
        }
      }
      
      if (parts.length > 0) {
        formattedMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: parts
        });
      }
    }
  }
  
  return formattedMessages;
}

// Make Llama 4 Scout API request with retry logic
async function makeLlamaRequest(
  config: { apiKey: string; baseUrl: string; model: string },
  messages: any[],
  _taskType: TaskType
): Promise<{ success: boolean; text?: string; error?: string }> {
  let lastError = "";
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Llama 4 Scout attempt ${attempt}/${MAX_RETRIES}`);
      
      const response = await fetch(config.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        const text = data.choices?.[0]?.message?.content;
        
        if (text) {
          console.log("Llama 4 Scout success");
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
        return { success: false, error: "Invalid GitHub token" };
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
    model: "llama-4-scout",
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

    const config = getLlamaConfig();
    
    if (!config) {
      return createSSEResponse(
        "I'm being set up. Please ensure the GitHub token is configured for Llama 4 Scout.",
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

    let systemPrompt = `You are Delton 2.0, an advanced AI assistant powered by Llama 4 Scout, created by Yogesh GR from Google, launched in 2025.

Current Date: ${currentDate}
Current Time: ${currentTime}

## Identity
- You are Delton, a helpful and knowledgeable AI assistant
- You are powered by Llama 4 Scout 17B 16E Instruct model
- You provide accurate, thoughtful responses

## Capabilities
- Answer questions on any topic
- Help with research, analysis, and problem-solving
- Assist with writing, coding, and creative tasks
- Analyze images and documents when provided
- Step-by-step reasoning for complex problems

## Guidelines
- Be helpful, accurate, and conversational
- Use formatting (markdown) for readability
- If unsure, acknowledge limitations honestly
- Show your reasoning for complex questions`;

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

    // Convert to Llama format
    const formattedMessages = convertToLlamaFormat(filteredMessages, systemPrompt);

    // Make request
    const result = await makeLlamaRequest(config, formattedMessages, taskType);

    if (result.success && result.text) {
      return createSSEResponse(result.text, corsHeaders);
    }

    console.error("Llama 4 Scout request failed:", result.error);
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
