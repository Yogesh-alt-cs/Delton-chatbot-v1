import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

const SOLVER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/problem-solver`;

export type ProblemType = 'math' | 'physics' | 'coding' | 'logic' | 'general';

interface SolverResult {
  success: boolean;
  solution: string;
  provider?: string;
  error?: string;
}

export function useProblemSolver() {
  const [isSolving, setIsSolving] = useState(false);
  const { toast } = useToast();

  const solveProblem = useCallback(async (
    problem: string,
    problemType: ProblemType = 'general',
    showSteps: boolean = true
  ): Promise<SolverResult> => {
    setIsSolving(true);

    try {
      const response = await fetch(SOLVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          problem,
          problemType,
          showSteps,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Solving failed' }));
        throw new Error(error.error || 'Problem solving failed');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Solving failed');
      }

      return {
        success: true,
        solution: data.solution,
        provider: data.provider,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Problem solving failed';
      toast({
        title: 'Solving Failed',
        description: message,
        variant: 'destructive',
      });
      return {
        success: false,
        solution: '',
        error: message,
      };
    } finally {
      setIsSolving(false);
    }
  }, [toast]);

  // Convenience methods for specific problem types
  const solveMath = useCallback((problem: string) => 
    solveProblem(problem, 'math', true), [solveProblem]);

  const solvePhysics = useCallback((problem: string) => 
    solveProblem(problem, 'physics', true), [solveProblem]);

  const solveCoding = useCallback((problem: string) => 
    solveProblem(problem, 'coding', true), [solveProblem]);

  const solveLogic = useCallback((problem: string) => 
    solveProblem(problem, 'logic', true), [solveProblem]);

  return {
    solveProblem,
    solveMath,
    solvePhysics,
    solveCoding,
    solveLogic,
    isSolving,
  };
}
