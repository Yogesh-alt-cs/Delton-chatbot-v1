import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced text extraction with multiple strategies
async function extractTextFromPDF(arrayBuffer: ArrayBuffer, fileName: string): Promise<{ text: string; method: string }> {
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Strategy 1: Try basic text extraction from PDF stream
  let extractedText = '';
  try {
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = textDecoder.decode(uint8Array);
    
    // Extract text between BT and ET markers (PDF text objects)
    const textMatches = rawText.match(/BT[\s\S]*?ET/g) || [];
    for (const match of textMatches) {
      // Extract text from Tj and TJ operators
      const tjMatches = match.match(/\(([^)]*)\)\s*Tj/g) || [];
      const tjArrayMatches = match.match(/\[([^\]]*)\]\s*TJ/g) || [];
      
      for (const tj of tjMatches) {
        const text = tj.match(/\(([^)]*)\)/)?.[1] || '';
        extractedText += text + ' ';
      }
      
      for (const tja of tjArrayMatches) {
        const parts = tja.match(/\(([^)]*)\)/g) || [];
        for (const part of parts) {
          extractedText += part.slice(1, -1) + ' ';
        }
      }
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (extractedText.length > 100) {
      return { text: extractedText, method: 'pdf-stream' };
    }
  } catch (e) {
    console.log('PDF stream extraction failed:', e);
  }

  // Strategy 2: Use AI vision for OCR fallback
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (LOVABLE_API_KEY) {
    try {
      console.log('Attempting AI-powered OCR for:', fileName);
      
      // Convert to base64
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);

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
                { 
                  type: 'text', 
                  text: `Extract ALL text content from this PDF document. This may be a scanned document that requires OCR. 

Instructions:
1. Extract every piece of readable text
2. Preserve the document structure (headings, paragraphs, lists)
3. Include tables in a readable format
4. If text is unclear, make your best attempt
5. Return ONLY the extracted text, no commentary

Begin extraction:` 
                },
                { 
                  type: 'image_url', 
                  image_url: { url: `data:application/pdf;base64,${base64}` } 
                }
              ]
            }
          ],
          max_tokens: 8000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const ocrText = data.choices?.[0]?.message?.content || '';
        if (ocrText.length > 50) {
          return { text: ocrText, method: 'ai-ocr' };
        }
      }
    } catch (e) {
      console.error('AI OCR failed:', e);
    }
  }

  // Strategy 3: Return what we have or indicate failure
  if (extractedText.length > 20) {
    return { text: extractedText, method: 'partial' };
  }

  return { 
    text: '[PDF content could not be extracted. The document may be encrypted, image-only, or in an unsupported format.]', 
    method: 'failed' 
  };
}

// Extract text from Word documents
function extractTextFromDocx(text: string): string {
  // Extract from document.xml content
  let extracted = text
    .replace(/<w:p[^>]*>/g, '\n') // Paragraph breaks
    .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1') // Text content
    .replace(/<[^>]*>/g, '') // Remove remaining XML
    .replace(/\s+/g, ' ')
    .trim();
  
  // Decode common XML entities
  extracted = extracted
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  return extracted;
}

// Split content into manageable chunks
function chunkContent(content: string, chunkSize: number = 1500): string[] {
  const chunks: string[] = [];
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = '';
  
  for (const para of paragraphs) {
    if (currentChunk.length + para.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      // If single paragraph is too long, split by sentences
      if (para.length > chunkSize) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        currentChunk = '';
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > chunkSize) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          } else {
            currentChunk += ' ' + sentence;
          }
        }
      } else {
        currentChunk = para;
      }
    } else {
      currentChunk += '\n\n' + para;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(c => c.length > 10);
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
    const fileSize = file.size;
    
    console.log(`Processing: ${fileName} (${fileType}, ${(fileSize / 1024).toFixed(1)}KB)`);

    // Check file size (max 10MB)
    if (fileSize > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, error: 'File too large. Maximum size is 10MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let textContent = '';
    let extractionMethod = 'direct';

    // Handle different file types
    if (['txt', 'md', 'csv', 'json'].includes(fileType)) {
      textContent = await file.text();
      extractionMethod = 'text';
    } else if (fileType === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await extractTextFromPDF(arrayBuffer, fileName);
      textContent = result.text;
      extractionMethod = result.method;
      console.log(`PDF extraction method: ${extractionMethod}`);
    } else if (['docx', 'doc'].includes(fileType)) {
      const text = await file.text();
      textContent = extractTextFromDocx(text);
      extractionMethod = 'docx';
      
      if (textContent.length < 50) {
        // Try AI extraction for complex docs
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        if (LOVABLE_API_KEY) {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64 = btoa(binary);

          try {
            const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [{
                  role: 'user',
                  content: `Extract all text from this Word document. Return only the text content:\n\nBase64 content: ${base64.slice(0, 50000)}`
                }],
              }),
            });

            if (response.ok) {
              const data = await response.json();
              const aiText = data.choices?.[0]?.message?.content || '';
              if (aiText.length > textContent.length) {
                textContent = aiText;
                extractionMethod = 'docx-ai';
              }
            }
          } catch (e) {
            console.error('DOCX AI extraction failed:', e);
          }
        }
      }
    } else {
      // Try to read as plain text
      try {
        textContent = await file.text();
        extractionMethod = 'fallback-text';
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: `Unsupported file format: ${fileType}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Clean and validate extracted text
    textContent = textContent
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control chars
      .trim();

    if (!textContent || textContent.length < 10) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not extract meaningful text from the document. It may be encrypted, image-only, or empty.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chunk the content
    const chunks = chunkContent(textContent, 1500);

    console.log(`Extraction complete: ${chunks.length} chunks, method: ${extractionMethod}`);

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        fileType,
        fileSize,
        extractionMethod,
        totalChunks: chunks.length,
        chunks: chunks.map((content, index) => ({
          index,
          content,
          length: content.length,
        })),
        fullText: textContent.slice(0, 10000), // First 10k chars preview
        totalLength: textContent.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Document parsing error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to parse document' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});