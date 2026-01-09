import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get the best reasoning provider
function getReasoningProvider(): { url: string; headers: Record<string, string>; model: string } | null {
  // Try DeepSeek first (best for reasoning)
  const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (deepseekKey) {
    return {
      url: "https://api.deepseek.com/chat/completions",
      headers: {
        Authorization: `Bearer ${deepseekKey}`,
        "Content-Type": "application/json",
      },
      model: "deepseek-reasoner",
    };
  }

  // Try Gemini
  const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (geminiKey) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      headers: {
        Authorization: `Bearer ${geminiKey}`,
        "Content-Type": "application/json",
      },
      model: "gemini-2.5-pro-preview-06-05",
    };
  }

  // Try OpenAI
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      model: "gpt-4o",
    };
  }

  // Fallback to Lovable AI
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      model: "google/gemini-3-pro-preview",
    };
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { problem, problemType, showSteps } = await req.json();

    if (!problem) {
      return new Response(
        JSON.stringify({ error: "Problem statement is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const provider = getReasoningProvider();
    if (!provider) {
      return new Response(
        JSON.stringify({ error: "No reasoning-capable AI provider configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Problem solving with:", provider.model);

    // Type-specific system prompts
    const typePrompts: Record<string, string> = {
      math: `You are an expert mathematician. Solve the problem step by step:
1. Identify what is being asked
2. List known information
3. Choose the appropriate method/formula
4. Show each calculation step clearly
5. Verify your answer
6. State the final answer clearly`,
      
      physics: `You are an expert physicist. Solve the problem systematically:
1. Identify the physics concepts involved
2. List given quantities with units
3. State relevant equations/principles
4. Show substitutions and calculations
5. Check units consistency
6. State the final answer with units`,
      
      coding: `You are an expert programmer. Solve the problem:
1. Understand the requirements
2. Break down the problem
3. Choose an appropriate algorithm/approach
4. Write clean, commented code
5. Explain the solution
6. Discuss time/space complexity`,
      
      logic: `You are an expert in logical reasoning. Solve step by step:
1. Identify premises and conclusion
2. Determine the type of reasoning
3. Apply logical rules/principles
4. Show each inference step
5. State the conclusion
6. Verify the reasoning is valid`,
      
      general: `You are an expert problem solver. Approach this systematically:
1. Understand what is being asked
2. Break down the problem
3. Apply relevant knowledge
4. Show your reasoning
5. Verify your solution
6. State the answer clearly`,
    };

    const systemPrompt = typePrompts[problemType] || typePrompts.general;

    const userPrompt = showSteps !== false
      ? `Solve this problem step by step, showing all work:\n\n${problem}`
      : `Solve this problem (you may show brief steps if helpful):\n\n${problem}`;

    const response = await fetch(provider.url, {
      method: "POST",
      headers: provider.headers,
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1, // Low temperature for accuracy
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Problem solver API error:", response.status, errorText);
      throw new Error(`Problem solving failed: ${response.status}`);
    }

    const data = await response.json();
    const solution = data.choices?.[0]?.message?.content;

    return new Response(
      JSON.stringify({ 
        success: true, 
        solution,
        provider: provider.model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Problem solver error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Problem solving failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
