import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
}

interface SearchResponse {
  success: boolean;
  data?: SearchResult[];
  error?: string;
}

// Keywords that indicate a need for live search
const LIVE_SEARCH_TRIGGERS = [
  'latest', 'current', 'today', 'now', 'recent', 'news',
  'weather', 'stock', 'price', 'score', 'match', 'game',
  'election', 'update', 'breaking', 'live', 'real-time',
  'happening', 'trending', 'this week', 'this month',
  'yesterday', 'tomorrow', '2025', '2026', 'right now'
];

// Topics that typically need live data
const LIVE_TOPICS = [
  'bitcoin', 'crypto', 'stock market', 'nasdaq', 'dow jones',
  'premier league', 'nba', 'nfl', 'cricket', 'football',
  'president', 'election', 'government', 'politics',
  'earthquake', 'hurricane', 'disaster', 'emergency'
];

export function needsLiveSearch(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Check for trigger words
  const hasTrigger = LIVE_SEARCH_TRIGGERS.some(trigger => 
    lowerQuery.includes(trigger)
  );
  
  // Check for live topics
  const hasTopic = LIVE_TOPICS.some(topic => 
    lowerQuery.includes(topic)
  );
  
  // Check for question patterns about current state
  const hasCurrentPattern = /what('s| is) (the )?(current|latest|today)/i.test(query) ||
    /how (is|are) .* (doing|performing)/i.test(query) ||
    /who (won|is winning|scored)/i.test(query);
  
  return hasTrigger || hasTopic || hasCurrentPattern;
}

export async function searchWeb(query: string, limit = 5): Promise<SearchResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('firecrawl-search', {
      body: { query, limit }
    });

    if (error) {
      console.error('Search error:', error);
      return { success: false, error: error.message };
    }

    return data;
  } catch (error) {
    console.error('Search failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Search failed' 
    };
  }
}

export function formatSearchResults(results: SearchResult[]): string {
  if (!results || results.length === 0) {
    return '';
  }

  let formatted = '\n\n---\n**Live Search Results:**\n\n';
  
  results.forEach((result, index) => {
    formatted += `**${index + 1}. ${result.title || result.url}**\n`;
    if (result.description) {
      formatted += `${result.description}\n`;
    }
    if (result.markdown) {
      // Take first 500 chars of content
      const preview = result.markdown.slice(0, 500);
      formatted += `${preview}${result.markdown.length > 500 ? '...' : ''}\n`;
    }
    formatted += `Source: ${result.url}\n\n`;
  });

  return formatted;
}

export function useWebSearch() {
  return {
    needsLiveSearch,
    searchWeb,
    formatSearchResults
  };
}
