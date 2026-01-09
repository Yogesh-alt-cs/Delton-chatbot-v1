import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

const VISION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vision-analyze`;

export type AnalysisType = 'general' | 'ocr' | 'math' | 'diagram' | 'code' | 'document';

interface VisionResult {
  success: boolean;
  analysis: string;
  provider?: string;
  error?: string;
}

export function useVisionAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const analyzeImage = useCallback(async (
    imageBase64: string,
    prompt?: string,
    analysisType: AnalysisType = 'general'
  ): Promise<VisionResult> => {
    setIsAnalyzing(true);

    try {
      const response = await fetch(VISION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          image: imageBase64,
          prompt,
          analysisType,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(error.error || 'Vision analysis failed');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      return {
        success: true,
        analysis: data.analysis,
        provider: data.provider,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vision analysis failed';
      toast({
        title: 'Analysis Failed',
        description: message,
        variant: 'destructive',
      });
      return {
        success: false,
        analysis: '',
        error: message,
      };
    } finally {
      setIsAnalyzing(false);
    }
  }, [toast]);

  // Convenience methods for specific analysis types
  const extractText = useCallback((imageBase64: string) => 
    analyzeImage(imageBase64, undefined, 'ocr'), [analyzeImage]);

  const solveMathProblem = useCallback((imageBase64: string) => 
    analyzeImage(imageBase64, undefined, 'math'), [analyzeImage]);

  const analyzeDiagram = useCallback((imageBase64: string) => 
    analyzeImage(imageBase64, undefined, 'diagram'), [analyzeImage]);

  const analyzeCode = useCallback((imageBase64: string) => 
    analyzeImage(imageBase64, undefined, 'code'), [analyzeImage]);

  return {
    analyzeImage,
    extractText,
    solveMathProblem,
    analyzeDiagram,
    analyzeCode,
    isAnalyzing,
  };
}
