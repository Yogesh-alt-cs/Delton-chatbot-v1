import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document`;

interface DocumentChunk {
  index: number;
  content: string;
  length: number;
}

interface ParsedDocument {
  fileName: string;
  fileType: string;
  totalChunks: number;
  chunks: DocumentChunk[];
  fullText: string;
}

interface StoredDocument {
  id: string;
  fileName: string;
  fileType: string;
  chunkCount: number;
  createdAt: string;
}

export function useDocumentRAG() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);

  // Parse and store a document
  const uploadDocument = useCallback(async (
    file: File,
    conversationId?: string
  ): Promise<ParsedDocument | null> => {
    if (!user) return null;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(PARSE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to parse document');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Parsing failed');
      }

      // Store chunks in database
      const chunksToInsert = data.chunks.map((chunk: DocumentChunk) => ({
        user_id: user.id,
        conversation_id: conversationId || null,
        file_name: data.fileName,
        file_type: data.fileType,
        chunk_index: chunk.index,
        content: chunk.content,
        metadata: { length: chunk.length },
      }));

      const { error: insertError } = await supabase
        .from('document_chunks')
        .insert(chunksToInsert);

      if (insertError) {
        console.error('Error storing chunks:', insertError);
        // Continue anyway, we have the parsed content
      }

      return {
        fileName: data.fileName,
        fileType: data.fileType,
        totalChunks: data.totalChunks,
        chunks: data.chunks,
        fullText: data.fullText,
      };
    } catch (err) {
      console.error('Document upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

  // Get all documents for current user
  const loadDocuments = useCallback(async (): Promise<StoredDocument[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('document_chunks')
        .select('file_name, file_type, created_at')
        .eq('user_id', user.id)
        .eq('chunk_index', 0) // Get first chunk of each doc
        .order('created_at', { ascending: false });

      if (error) throw error;

      const docs: StoredDocument[] = (data || []).map((d) => ({
        id: d.file_name,
        fileName: d.file_name,
        fileType: d.file_type,
        chunkCount: 1, // We'll count later if needed
        createdAt: d.created_at,
      }));

      setDocuments(docs);
      return docs;
    } catch (err) {
      console.error('Error loading documents:', err);
      return [];
    }
  }, [user]);

  // Search documents for relevant content
  const searchDocuments = useCallback(async (
    query: string,
    fileName?: string,
    limit: number = 5
  ): Promise<string> => {
    if (!user) return '';

    try {
      let queryBuilder = supabase
        .from('document_chunks')
        .select('file_name, content, chunk_index')
        .eq('user_id', user.id)
        .limit(limit * 2); // Get more and filter

      if (fileName) {
        queryBuilder = queryBuilder.eq('file_name', fileName);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      if (!data || data.length === 0) return '';

      // Simple keyword matching for relevance
      const queryWords = query.toLowerCase().split(/\s+/);
      const scored = data.map(chunk => {
        const content = chunk.content.toLowerCase();
        const score = queryWords.filter(word => content.includes(word)).length;
        return { ...chunk, score };
      });

      // Sort by relevance and take top results
      const relevant = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .filter(c => c.score > 0);

      if (relevant.length === 0) {
        // Return first chunks if no keyword match
        return data.slice(0, 3).map(c => c.content).join('\n\n');
      }

      return relevant.map(c => c.content).join('\n\n');
    } catch (err) {
      console.error('Document search error:', err);
      return '';
    }
  }, [user]);

  // Delete a document
  const deleteDocument = useCallback(async (fileName: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('document_chunks')
        .delete()
        .eq('user_id', user.id)
        .eq('file_name', fileName);

      if (error) throw error;
      
      setDocuments(prev => prev.filter(d => d.fileName !== fileName));
      return true;
    } catch (err) {
      console.error('Error deleting document:', err);
      return false;
    }
  }, [user]);

  // Format document content for AI context
  const formatForContext = useCallback((doc: ParsedDocument): string => {
    let context = `\n\n---\n📄 **Document: ${doc.fileName}**\n`;
    context += `Type: ${doc.fileType.toUpperCase()}\n\n`;
    context += doc.fullText;
    context += '\n---\n';
    return context;
  }, []);

  return {
    uploadDocument,
    loadDocuments,
    searchDocuments,
    deleteDocument,
    formatForContext,
    documents,
    isProcessing,
    error,
  };
}
