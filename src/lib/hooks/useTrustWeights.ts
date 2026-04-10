"use client";

import { useCallback, useEffect, useState } from 'react';
import { EvaluatorTrust, UpdateTrustWeightsRequest } from '@/types/evaluation';
import { getTrustWeights, updateTrustWeights } from '@/lib/evaluation-api';

export function useTrustWeights() {
  const [weights, setWeights] = useState<EvaluatorTrust[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchWeights = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getTrustWeights();
      setWeights(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch trust weights'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeights();
  }, [fetchWeights]);

  const saveWeights = useCallback(async (newWeights: UpdateTrustWeightsRequest) => {
    try {
      setIsSaving(true);
      const data = await updateTrustWeights(newWeights);
      setWeights(data);
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update trust weights'));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { weights, isLoading, isSaving, error, refetch: fetchWeights, saveWeights };
}
