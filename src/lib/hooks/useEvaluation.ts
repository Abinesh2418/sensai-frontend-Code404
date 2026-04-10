"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Evaluation, EvaluationExplanationData } from '@/types/evaluation';
import { getEvaluation, getUserEvaluation, getEvaluationExplanation } from '@/lib/evaluation-api';

interface UseEvaluationOptions {
  evaluationId?: number;
  userId?: number;
  taskId?: number;
  pollInterval?: number; // ms, polling for status updates
}

export function useEvaluation({ evaluationId, userId, taskId, pollInterval = 5000 }: UseEvaluationOptions) {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [explanation, setExplanation] = useState<EvaluationExplanationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEvaluation = useCallback(async () => {
    try {
      let data: Evaluation;
      if (evaluationId) {
        data = await getEvaluation(evaluationId);
      } else if (userId && taskId) {
        data = await getUserEvaluation(userId, taskId);
      } else {
        return;
      }
      setEvaluation(data);
      setError(null);

      // Fetch explanation when status is provisional or final
      if (data.status === 'provisional' || data.status === 'final') {
        try {
          const explanationData = await getEvaluationExplanation(data.id);
          setExplanation(explanationData);
        } catch {
          // Explanation may not be available yet
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch evaluation'));
    } finally {
      setIsLoading(false);
    }
  }, [evaluationId, userId, taskId]);

  useEffect(() => {
    if (!evaluationId && !(userId && taskId)) {
      setIsLoading(false);
      return;
    }

    fetchEvaluation();

    // Poll while evaluation is not final
    intervalRef.current = setInterval(() => {
      if (evaluation?.status === 'final') {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      fetchEvaluation();
    }, pollInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [evaluationId, userId, taskId, pollInterval, fetchEvaluation, evaluation?.status]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    return fetchEvaluation();
  }, [fetchEvaluation]);

  return { evaluation, explanation, isLoading, error, refetch };
}
