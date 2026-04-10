"use client";

import React from 'react';
import { useEvaluation } from '@/lib/hooks/useEvaluation';
import EvaluationDisplay from './EvaluationDisplay';
import EvaluationStatusIndicator from './EvaluationStatusIndicator';
import { Loader2 } from 'lucide-react';

interface EvaluationPanelProps {
  userId?: string;
  taskId?: string;
  className?: string;
  compactStatus?: boolean;
}

export default function EvaluationPanel({
  userId,
  taskId,
  className = '',
  compactStatus = false,
}: EvaluationPanelProps) {
  const { evaluation, explanation, isLoading, error } = useEvaluation({
    userId: userId ? parseInt(userId) : undefined,
    taskId: taskId ? parseInt(taskId) : undefined,
    pollInterval: 5000,
  });

  if (!userId || !taskId) return null;

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-6 ${className}`}>
        <Loader2 size={18} className="animate-spin text-gray-400 dark:text-zinc-500 mr-2" />
        <span className="text-sm text-gray-500 dark:text-zinc-400">Loading evaluation...</span>
      </div>
    );
  }

  if (error || !evaluation) return null;

  if (compactStatus) {
    return (
      <EvaluationStatusIndicator
        status={evaluation.status}
        compact
      />
    );
  }

  return (
    <div className={className}>
      <EvaluationDisplay
        evaluation={evaluation}
        explanation={explanation}
      />
    </div>
  );
}
