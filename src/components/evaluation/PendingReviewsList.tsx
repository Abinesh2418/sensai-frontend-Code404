"use client";

import React, { useMemo } from 'react';
import { PendingReview } from '@/types/evaluation';
import { usePendingReviews } from '@/lib/hooks/usePendingReviews';
import { ChevronRight, Loader2, ClipboardList } from 'lucide-react';
import Link from 'next/link';

interface PendingReviewsListProps {
  schoolSlug?: string;
  className?: string;
}

interface GroupedAssessment {
  user_id: number;
  user_name: string;
  task_id: number;
  task_title: string;
  questions: PendingReview[];
  total_score: number;
  total_max: number;
  created_at: string;
}

export default function PendingReviewsList({ schoolSlug, className = '' }: PendingReviewsListProps) {
  const { reviews, isLoading, error, refetch } = usePendingReviews();

  const grouped = useMemo(() => {
    const map = new Map<string, GroupedAssessment>();
    for (const r of reviews) {
      const key = `${r.user_id}-${r.task_id}`;
      if (!map.has(key)) {
        map.set(key, {
          user_id: r.user_id,
          user_name: r.user_name,
          task_id: r.task_id,
          task_title: r.task_title,
          questions: [],
          total_score: 0,
          total_max: 0,
          created_at: r.created_at,
        });
      }
      const g = map.get(key)!;
      g.questions.push(r);
      if (r.ai_score !== null) g.total_score += r.ai_score;
      g.total_max += r.max_score;
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [reviews]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader2 size={24} className="animate-spin text-gray-400 dark:text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3">Failed to load pending reviews</p>
        <button onClick={refetch} className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">Retry</button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-light text-gray-900 dark:text-white">Pending Assessments</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            {grouped.length} assessment{grouped.length !== 1 ? 's' : ''} awaiting evaluation
          </p>
        </div>
        <button onClick={refetch} className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 cursor-pointer">Refresh</button>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-8">
          <ClipboardList size={32} className="mx-auto text-gray-300 dark:text-zinc-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">No pending assessments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(g => {
            const scorePercent = g.total_max > 0 ? Math.round((g.total_score / g.total_max) * 100) : 0;
            const href = schoolSlug
              ? `/school/${schoolSlug}/evaluation/${g.user_id}/${g.task_id}`
              : `/school/evaluation/${g.user_id}/${g.task_id}`;

            return (
              <Link
                key={`${g.user_id}-${g.task_id}`}
                href={href}
                className="flex items-center justify-between p-5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-base font-medium text-gray-900 dark:text-white">{g.user_name}</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Pending Review
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-zinc-400">{g.task_title}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-zinc-500">
                    <span>{g.questions.length} question{g.questions.length !== 1 ? 's' : ''}</span>
                    {g.total_max > 0 && (
                      <span>AI Score: {g.total_score.toFixed(0)} / {g.total_max} ({scorePercent}%)</span>
                    )}
                    <span>{new Date(g.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-400 dark:text-zinc-500 flex-shrink-0 ml-4" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
