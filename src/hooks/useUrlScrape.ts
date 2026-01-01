import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ScrapeResult {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
    };
  };
  error?: string;
}

export function useUrlScrape() {
  const [isLoading, setIsLoading] = useState(false);

  const scrapeUrl = useCallback(async (url: string): Promise<ScrapeResult> => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
        body: { url },
      });

      if (error) {
        console.error('Firecrawl error:', error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || 'Failed to scrape URL' };
      }

      return { success: true, data: data.data };
    } catch (err) {
      console.error('Scrape error:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to scrape URL' 
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Detect URLs in text
  const extractUrls = useCallback((text: string): string[] => {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    return text.match(urlRegex) || [];
  }, []);

  return {
    scrapeUrl,
    extractUrls,
    isLoading,
  };
}
