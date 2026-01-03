import { useState, useCallback } from 'react';

const CODE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/code-interpreter`;

interface ExecutionResult {
  success: boolean;
  code: string;
  output: string;
  error: string | null;
  explanation: string;
}

export function useCodeInterpreter() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Execute code directly
  const executeCode = useCallback(async (code: string): Promise<ExecutionResult | null> => {
    if (!code.trim()) return null;

    setIsExecuting(true);
    setError(null);

    try {
      const response = await fetch(CODE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Execution failed');
      }

      const data = await response.json();
      
      const result: ExecutionResult = {
        success: data.success,
        code: data.code || code,
        output: data.output || '',
        error: data.error || null,
        explanation: data.explanation || '',
      };

      setLastResult(result);
      return result;
    } catch (err) {
      console.error('Code execution error:', err);
      setError(err instanceof Error ? err.message : 'Execution failed');
      return null;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  // Execute a task (AI generates and runs code)
  const executeTask = useCallback(async (task: string): Promise<ExecutionResult | null> => {
    if (!task.trim()) return null;

    setIsExecuting(true);
    setError(null);

    try {
      const response = await fetch(CODE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ task }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Execution failed');
      }

      const data = await response.json();
      
      const result: ExecutionResult = {
        success: data.success,
        code: data.code || '',
        output: data.output || '',
        error: data.error || null,
        explanation: data.explanation || '',
      };

      setLastResult(result);
      return result;
    } catch (err) {
      console.error('Task execution error:', err);
      setError(err instanceof Error ? err.message : 'Execution failed');
      return null;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  // Format result for AI context
  const formatForContext = useCallback((result: ExecutionResult): string => {
    let context = '\n\n---\n💻 **Code Execution Result**\n';
    
    if (result.code) {
      context += '\n```python\n' + result.code + '\n```\n';
    }
    
    if (result.output) {
      context += '\n**Output:**\n```\n' + result.output + '\n```\n';
    }
    
    if (result.error) {
      context += '\n**Error:**\n```\n' + result.error + '\n```\n';
    }
    
    if (result.explanation) {
      context += '\n**Explanation:** ' + result.explanation + '\n';
    }
    
    context += '\n---\n';
    return context;
  }, []);

  return {
    executeCode,
    executeTask,
    formatForContext,
    isExecuting,
    lastResult,
    error,
  };
}
