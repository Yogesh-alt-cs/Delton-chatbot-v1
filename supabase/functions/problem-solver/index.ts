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
    url: "https://models.github.ai/inference/chat/completions",
    headers: {
      "Authorization": `Bearer ${githubToken}`,
      "Content-Type": "application/json",
    },
    model: "meta/llama-4-scout-17b-16e-instruct",
  };
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

    const config = getLlamaConfig();
    if (!config) {
      return new Response(
        JSON.stringify({ error: "Llama 4 Scout is not configured. Please add GITHUB_TOKEN." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Problem solving with Llama 4 Scout");

    // Type-specific system prompts
    const typePrompts: Record<string, string> = {
      math: `You are an expert mathematician using Llama 4 Scout. Solve the problem step by step:
1. Identify what is being asked
2. List known information
3. Choose the appropriate method/formula
4. Show each calculation step clearly
5. Verify your answer
6. State the final answer clearly`,
      
      physics: `You are an expert physicist using Llama 4 Scout. Solve the problem systematically:
1. Identify the physics concepts involved
2. List given quantities with units
3. State relevant equations/principles
4. Show substitutions and calculations
5. Check units consistency
6. State the final answer with units`,
      
      coding: `You are an expert programmer using Llama 4 Scout. Solve the problem:
1. Understand the requirements
2. Break down the problem
3. Choose an appropriate algorithm/approach
4. Write clean, commented code
5. Explain the solution
6. Discuss time/space complexity`,
      
      logic: `You are an expert in logical reasoning using Llama 4 Scout. Solve step by step:
1. Identify premises and conclusion
2. Determine the type of reasoning
3. Apply logical rules/principles
4. Show each inference step
5. State the conclusion
6. Verify the reasoning is valid`,
      
      general: `You are an expert problem solver using Llama 4 Scout. Approach this systematically:
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

    let lastError = "";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Problem solver attempt ${attempt}/${MAX_RETRIES}`);

        const response = await fetch(config.url, {
          method: "POST",
          headers: config.headers,
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.1, // Low temperature for accuracy
            max_tokens: 4096,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const solution = data.choices?.[0]?.message?.content;

          return new Response(
            JSON.stringify({ 
              success: true, 
              solution,
              provider: "llama-4-scout",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const status = response.status;
        const errorText = await response.text();
        console.error(`Attempt ${attempt} failed:`, status, errorText);

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

    console.error("All problem solver attempts failed:", lastError);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Problem solving service is temporarily unavailable. Please try again." 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
