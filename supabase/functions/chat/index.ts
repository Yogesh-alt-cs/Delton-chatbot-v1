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

TIME-SENSITIVE INFORMATION:
For live search results, cite sources when available. For other time-sensitive topics:
- Stock/crypto prices: Use search results or acknowledge need for verification
- News: Reference search results or suggest verification
- Weather/sports: Suggest live sources if no search results provided

REMINDER FEATURE:
If the user asks you to remind them about something, extract and include the reminder using this EXACT format:
[REMINDER: title="what to remind" time="ISO datetime"]

Example: "Remind me in 30 minutes" -> [REMINDER: title="Reminder" time="${new Date(now.getTime() + 30 * 60000).toISOString()}"]

IMPORTANT GUIDELINES:
- Leverage all context provided (search results, documents, memories)
- Never fabricate information - use provided context or acknowledge uncertainty
- Be helpful, be accurate, be Delton 2.0`;

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
