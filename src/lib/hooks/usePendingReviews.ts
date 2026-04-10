"use client";

import { useCallback, useEffect, useState } from 'react';
import { PendingReview } from '@/types/evaluation';
import { getPendingReviews } from '@/lib/evaluation-api';

export function usePendingReviews() {
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getPendingReviews();
      setReviews(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch pending reviews'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  return { reviews, isLoading, error, refetch: fetchReviews };
}
