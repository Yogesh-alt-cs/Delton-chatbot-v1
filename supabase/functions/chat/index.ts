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

    const systemPrompt = `You are Delton, a friendly and helpful AI assistant created in 2025. ${styleGuide} ${userGreeting}

Current Date: ${currentDate}
Current Time: ${currentTime}

Key capabilities:
- You can tell users the current date and time when asked
- You have knowledge up to your training cutoff and can discuss recent events, technologies, and trends from 2024-2025
- You can help with general knowledge, technical questions, creative writing, problem-solving, coding, and more
- When asked about real-time data (like live stock prices, weather, or breaking news), explain that you don't have live internet access but can discuss general information

When you don't know something, you say so honestly. Always be helpful and provide the most accurate information based on your training data.`;

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
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
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
