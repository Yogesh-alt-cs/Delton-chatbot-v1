import { useState, useCallback } from 'react';

const PERPLEXITY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/perplexity-search`;

interface SearchResult {
  content: string;
  citations: string[];
}

interface SearchOptions {
  model?: 'sonar' | 'sonar-pro' | 'sonar-reasoning';
  recencyFilter?: 'day' | 'week' | 'month' | 'year';
}

export function usePerplexitySearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult | null> => {
    if (!query.trim()) return null;

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch(PERPLEXITY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query, options }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      return {
        content: data.content,
        citations: data.citations || [],
      };
    } catch (err) {
      console.error('Perplexity search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      return null;
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Format search results for AI context
  const formatForContext = useCallback((result: SearchResult): string => {
    let context = '\n\n---\n🔍 **Live Search Results (Perplexity)**\n';
    context += result.content;
    
    if (result.citations.length > 0) {
      context += '\n\n**Sources:**\n';
      result.citations.slice(0, 5).forEach((url, i) => {
        context += `${i + 1}. ${url}\n`;
      });
    }
    
    context += '\n---\n';
    return context;
  }, []);

  return {
    search,
    formatForContext,
    isSearching,
    error,
  };
}
