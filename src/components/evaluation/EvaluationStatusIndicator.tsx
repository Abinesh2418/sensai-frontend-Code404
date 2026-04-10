"use client";

import React from 'react';
import { EvaluationStatus } from '@/types/evaluation';
import { Clock, Loader2, CheckCircle2, Shield } from 'lucide-react';
import Tooltip from '@/components/Tooltip';

interface EvaluationStatusIndicatorProps {
  status: EvaluationStatus;
  timestamps?: {
    created_at?: string;
    updated_at?: string;
  };
  compact?: boolean;
}

const STATUS_CONFIG: Record<EvaluationStatus, {
  label: string;
  description: string;
  icon: React.ElementType;
  badgeClass: string;
  dotClass: string;
}> = {
  pending: {
    label: 'Pending',
    description: 'Evaluation has been queued and will begin shortly',
    icon: Clock,
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300',
    dotClass: 'bg-gray-400 dark:bg-zinc-500',
  },
  in_progress: {
    label: 'In Progress',
    description: 'AI and embedding evaluators are analyzing the submission',
    icon: Loader2,
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  provisional: {
    label: 'Provisional',
    description: 'AI and embedding scoring complete. Awaiting mentor review before final result',
    icon: CheckCircle2,
    badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dotClass: 'bg-blue-500',
  },
  final: {
    label: 'Final',
    description: 'Mentor review complete. All signals combined into final score',
    icon: Shield,
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
};

const STEPS: EvaluationStatus[] = ['pending', 'in_progress', 'provisional', 'final'];

function formatTimestamp(ts?: string) {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EvaluationStatusIndicator({
  status,
  timestamps,
  compact = false,
}: EvaluationStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const currentIndex = STEPS.indexOf(status);

  if (compact) {
    return (
      <Tooltip content={config.description} position="top">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.badgeClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass} ${status === 'in_progress' ? 'animate-pulse' : ''}`} />
          {config.label}
        </span>
      </Tooltip>
    );
  }

  return (
    <div className="w-full">
      {/* Timeline */}
      <div className="flex items-center justify-between relative">
        {STEPS.map((step, index) => {
          const stepConfig = STATUS_CONFIG[step];
          const StepIcon = stepConfig.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <React.Fragment key={step}>
              {/* Step circle */}
              <Tooltip content={stepConfig.description} position="top">
                <div className="flex flex-col items-center z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                        : isCurrent
                          ? `${stepConfig.badgeClass} ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#1A1A1A] ${
                              step === 'pending' ? 'ring-gray-300 dark:ring-zinc-600' :
                              step === 'in_progress' ? 'ring-amber-300 dark:ring-amber-600' :
                              step === 'provisional' ? 'ring-blue-300 dark:ring-blue-600' :
                              'ring-emerald-300 dark:ring-emerald-600'
                            }`
                          : 'bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <StepIcon size={16} className={isCurrent && step === 'in_progress' ? 'animate-spin' : ''} />
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      isCurrent
                        ? 'text-gray-900 dark:text-white'
                        : isCompleted
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-400 dark:text-zinc-500'
                    }`}
                  >
                    {stepConfig.label}
                  </span>
                  {isCurrent && timestamps?.updated_at && (
                    <span className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
                      {formatTimestamp(timestamps.updated_at)}
                    </span>
                  )}
                </div>
              </Tooltip>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mt-[-24px] relative">
                  <div className="absolute inset-0 bg-gray-200 dark:bg-zinc-700 rounded-full" />
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                      isCompleted ? 'bg-emerald-400 dark:bg-emerald-500 w-full' :
                      isCurrent ? 'bg-amber-400 dark:bg-amber-500 w-1/2' : 'w-0'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
