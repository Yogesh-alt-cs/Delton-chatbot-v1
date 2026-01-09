import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get the best vision-capable provider
function getVisionProvider(): { url: string; headers: Record<string, string>; model: string } | null {
  // Try Gemini first (best for vision)
  const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (geminiKey) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      headers: {
        Authorization: `Bearer ${geminiKey}`,
        "Content-Type": "application/json",
      },
      model: "gemini-2.0-flash",
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
    const { image, prompt, analysisType } = await req.json();

    if (!image) {
      return new Response(
        JSON.stringify({ error: "Image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const provider = getVisionProvider();
    if (!provider) {
      return new Response(
        JSON.stringify({ error: "No vision-capable AI provider configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Vision analysis with:", provider.model);

    // Build analysis-specific prompts
    const analysisPrompts: Record<string, string> = {
      general: "Analyze this image in detail. Describe what you see, identify key elements, and explain any relevant context.",
      ocr: "Extract all text from this image. Provide the text exactly as it appears, maintaining formatting where possible.",
      math: "This image contains a math problem. Solve it step by step, showing your work clearly. Provide the final answer.",
      diagram: "This is a diagram or chart. Explain what it represents, describe its components, and interpret its meaning.",
      code: "This image contains code. Transcribe it, explain what it does, and identify any potential issues or improvements.",
      document: "Analyze this document. Summarize its content, extract key information, and answer any questions about it.",
    };

    const systemPrompt = `You are an advanced vision AI assistant with the following capabilities:
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

    const response = await fetch(provider.url, {
      method: "POST",
      headers: provider.headers,
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Vision API error:", response.status, errorText);
      throw new Error(`Vision analysis failed: ${response.status}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content;

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: result,
        provider: provider.model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Vision analysis error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Vision analysis failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
