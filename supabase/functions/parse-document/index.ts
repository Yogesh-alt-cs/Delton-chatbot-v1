import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple text extraction for various file types
function extractTextFromContent(content: string, fileType: string): string {
  // For plain text files
  if (fileType === 'txt' || fileType === 'csv' || fileType === 'md') {
    return content;
  }
  
  // Basic cleanup for other text-based formats
  return content
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

// Split content into chunks
function chunkContent(content: string, chunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  const sentences = content.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileName = file.name;
    const fileType = fileName.split('.').pop()?.toLowerCase() || '';
    
    console.log('Processing document:', fileName, 'type:', fileType);

    let textContent = '';

    // Handle different file types
    if (['txt', 'md', 'csv'].includes(fileType)) {
      // Plain text files
      textContent = await file.text();
    } else if (fileType === 'pdf') {
      // For PDF, we'll use AI to extract text
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI not configured for PDF parsing' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Convert PDF to base64 for AI processing
      const arrayBuffer = await file.arrayBuffer();
      const base64 = base64Encode(arrayBuffer);

      // Use vision model to extract text from PDF
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract all text content from this PDF document. Preserve the structure and formatting as much as possible. Return only the extracted text, no additional commentary.' },
                { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64}` } }
              ]
            }
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        textContent = data.choices?.[0]?.message?.content || '';
      } else {
        console.error('PDF extraction failed:', response.status);
        textContent = '[PDF content could not be extracted]';
      }
    } else if (['docx', 'doc'].includes(fileType)) {
      // For Word docs, try to extract text
      const text = await file.text();
      // Basic XML extraction for DOCX
      textContent = text
        .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1 ')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!textContent || textContent.length < 50) {
        textContent = '[Document content - please upload as PDF or TXT for better extraction]';
      }
    } else {
      // Try to read as text
      try {
        textContent = await file.text();
      } catch {
        textContent = '[Unsupported file format]';
      }
    }

    // Clean up the extracted text
    textContent = extractTextFromContent(textContent, fileType);

    // Chunk the content
    const chunks = chunkContent(textContent, 1500);

    console.log('Document parsed successfully, chunks:', chunks.length);

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        fileType,
        totalChunks: chunks.length,
        chunks: chunks.map((content, index) => ({
          index,
          content,
          length: content.length,
        })),
        fullText: textContent.slice(0, 5000), // Preview of first 5000 chars
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Document parsing error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Parsing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
