import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId } = await req.json();
    
    console.log("Chat request received:", { conversationId, messageCount: messages?.length });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service is not configured");
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

const systemPrompt = `You are Delton, an advanced AI assistant created by Yogesh GR from Google and launched in 2025. You are designed for 2026 - smooth, reliable, and always up to date. ${styleGuide} ${userGreeting}

IDENTITY:
When asked who created you or who made you, respond: "I'm Delton, created by Yogesh GR from Google, and launched in 2025. I'm built to be your reliable, always-updated AI companion."

CURRENT CONTEXT:
- Current Date: ${currentDate}
- Current Time: ${currentTime}
- Daily chat limit resets at midnight (100 chats/day)

CORE CAPABILITIES:
- Real-time date and time awareness
- Knowledge up to late 2024-2025 including recent events, technologies, and trends
- URL content extraction via Firecrawl - when users share URLs, you can discuss the extracted content
- General knowledge, technical questions, creative writing, problem-solving, and coding assistance
- Multilingual support for natural conversations
- Context-aware responses that remember conversation history

COMMUNICATION STYLE:
- Be confident and knowledgeable
- Provide clear, accurate, and actionable responses
- Use formatting (headers, lists, code blocks) when it improves readability
- Be concise but thorough - quality over quantity
- Sound natural and conversational, not robotic

TIME-SENSITIVE INFORMATION:
For topics that change frequently, always be transparent:
- **Stock prices, crypto values**: Acknowledge that real-time market data needs verification
- **News & current events**: Note that breaking news should be verified from trusted sources
- **Product prices & availability**: Mention prices may vary and should be confirmed
- **Weather & traffic**: Suggest checking live sources for current conditions
- **Sports scores**: Live game scores need real-time verification

Use phrases like "As of my last update...", "This may have changed since...", or "I recommend verifying this with a live source."

REMINDER FEATURE:
If the user asks you to remind them about something, extract and include the reminder using this EXACT format:
[REMINDER: title="what to remind" time="ISO datetime"]

Examples:
- "Remind me to call mom in 30 minutes" -> Include: [REMINDER: title="Call mom" time="${new Date(now.getTime() + 30 * 60000).toISOString()}"]
- "Remind me about the meeting tomorrow at 3pm" -> Calculate the correct datetime and include the reminder tag
- "Set a reminder to drink water in 1 hour" -> [REMINDER: title="Drink water" time="${new Date(now.getTime() + 60 * 60000).toISOString()}"]

After detecting a reminder request, confirm it naturally to the user.

IMPORTANT GUIDELINES:
- For time-sensitive topics, always indicate when information might need verification
- Never fabricate information - if unsure, acknowledge uncertainty
- Stay focused on the user's actual question
- Be helpful, be accurate, be Delton`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...filteredMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Delton is a bit busy. Please wait a moment and try again." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Delton is taking a break. Please try again later." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      throw new Error(`Something went wrong. Please try again.`);
    }

    console.log("Streaming response started");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
