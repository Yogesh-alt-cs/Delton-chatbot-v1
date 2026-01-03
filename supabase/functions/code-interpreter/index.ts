import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use Lovable AI to generate and validate Python code, then simulate execution
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, task } = await req.json();

    if (!code && !task) {
      return new Response(
        JSON.stringify({ success: false, error: 'Code or task is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Code interpreter request:', task ? 'task' : 'code');

    // Generate code if only task is provided, or analyze and execute provided code
    const systemPrompt = `You are a Python code interpreter. When given a task, write Python code to solve it. When given code, analyze it and provide the expected output.

IMPORTANT RULES:
1. For mathematical calculations, always compute the actual result
2. For data analysis, process the data and provide real outputs
3. If code would generate a chart/plot, describe what it would show
4. Return a JSON response with these fields:
   - code: the Python code (generated or original)
   - output: the execution result (actual computed values)
   - error: any errors (null if none)
   - explanation: brief explanation of what the code does

Always compute actual results for math, statistics, and data operations.`;

    const userMessage = task 
      ? `Task: ${task}\n\nWrite Python code to solve this and compute the result.`
      : `Execute this Python code and provide the output:\n\n${code}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Code execution failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: 'No response from interpreter' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = { output: content, code: code || '', error: null };
    }

    console.log('Code interpreter success');

    return new Response(
      JSON.stringify({
        success: true,
        code: result.code || code,
        output: result.output || '',
        error: result.error || null,
        explanation: result.explanation || '',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Code interpreter error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Execution failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
