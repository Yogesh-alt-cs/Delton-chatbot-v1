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
    const { image, prompt, analysisType } = await req.json();

    if (!image) {
      return new Response(
        JSON.stringify({ success: false, error: "Image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = getLlamaConfig();
    if (!config) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Vision service is being configured. Please add GITHUB_TOKEN." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Vision analysis with Llama 4 Scout");

    // Build analysis-specific prompts
    const analysisPrompts: Record<string, string> = {
      general: "Analyze this image in detail. Describe what you see, identify key elements, and explain any relevant context.",
      ocr: "Extract all text from this image. Provide the text exactly as it appears, maintaining formatting where possible.",
      math: "This image contains a math problem. Solve it step by step, showing your work clearly. Provide the final answer.",
      diagram: "This is a diagram or chart. Explain what it represents, describe its components, and interpret its meaning.",
      code: "This image contains code. Transcribe it, explain what it does, and identify any potential issues or improvements.",
      document: "Analyze this document. Summarize its content, extract key information, and answer any questions about it.",
    };

    const systemPrompt = `You are Delton 2.0, an advanced vision AI assistant powered by Llama 4 Scout with the following capabilities:
- Optical Character Recognition (OCR) for text extraction
- Mathematical problem solving from images
- Diagram and chart interpretation
- Code analysis and transcription
- Document summarization and analysis
- Object and scene recognition

Provide accurate, detailed analysis based on the image content.
If asked to solve a problem shown in the image, show your step-by-step work.
If extracting text, be precise and maintain original formatting.`;

    const userPrompt = prompt || analysisPrompts[analysisType] || analysisPrompts.general;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: {
              url: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`,
            },
          },
        ],
      },
    ];

    // Retry logic
    let lastError = "";
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Vision attempt ${attempt}/${MAX_RETRIES} with Llama 4 Scout`);
        
        const response = await fetch(config.url, {
          method: "POST",
          headers: config.headers,
          body: JSON.stringify({
            model: config.model,
            messages,
            max_tokens: 4096,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const result = data.choices?.[0]?.message?.content;

          return new Response(
            JSON.stringify({ 
              success: true, 
              analysis: result,
              provider: "llama-4-scout",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const status = response.status;
        console.error(`Vision attempt ${attempt} failed:`, status);

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
        console.error(`Vision attempt ${attempt} error:`, err);
        lastError = err instanceof Error ? err.message : String(err);
        
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    // Graceful fallback
    console.error("All vision attempts failed:", lastError);
    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: "I couldn't fully analyze this image at the moment. Please try again or describe what you'd like me to look for.",
        provider: "fallback",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Vision analysis error:", error);
    
    // Always return graceful response
    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: "I encountered an issue analyzing this image. Please try uploading it again.",
        provider: "fallback",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
