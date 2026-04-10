"use client";

import { useCallback, useState } from 'react';
import { Evaluation, SubmitHumanFeedbackRequest } from '@/types/evaluation';
import { submitMentorFeedback } from '@/lib/evaluation-api';

export function useSubmitFeedback() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<Evaluation | null>(null);

  const submit = useCallback(async (evaluationId: number, feedback: SubmitHumanFeedbackRequest) => {
    try {
      setIsSubmitting(true);
      setError(null);
      const data = await submitMentorFeedback(evaluationId, feedback);
      setResult(data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit feedback');
      setError(error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { submit, isSubmitting, error, result, reset };
}
