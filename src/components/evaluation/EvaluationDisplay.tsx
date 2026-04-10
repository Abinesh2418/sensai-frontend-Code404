"use client";

import React, { useState } from 'react';
import { Evaluation, EvaluationSignal, EvaluationExplanationData, EvaluatorType } from '@/types/evaluation';
import EvaluationStatusIndicator from './EvaluationStatusIndicator';
import EvaluationExplanation from './EvaluationExplanation';
import { ChevronDown, ChevronUp, Bot, Cpu, User } from 'lucide-react';

interface EvaluationDisplayProps {
  evaluation: Evaluation;
  explanation?: EvaluationExplanationData | null;
  className?: string;
}

const SIGNAL_CONFIG: Record<EvaluatorType, {
  label: string;
  icon: React.ElementType;
  borderClass: string;
  iconBgClass: string;
  iconTextClass: string;
}> = {
  ai: {
    label: 'AI Evaluator',
    icon: Bot,
    borderClass: 'border-l-blue-500',
    iconBgClass: 'bg-blue-50 dark:bg-blue-900/20',
    iconTextClass: 'text-blue-600 dark:text-blue-400',
  },
  embedding: {
    label: 'Embedding Evaluator',
    icon: Cpu,
    borderClass: 'border-l-emerald-500',
    iconBgClass: 'bg-emerald-50 dark:bg-emerald-900/20',
    iconTextClass: 'text-emerald-600 dark:text-emerald-400',
  },
  human: {
    label: 'Mentor Feedback',
    icon: User,
    borderClass: 'border-l-purple-500',
    iconBgClass: 'bg-purple-50 dark:bg-purple-900/20',
    iconTextClass: 'text-purple-600 dark:text-purple-400',
  },
};

function SignalCard({ signal }: { signal: EvaluationSignal }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = SIGNAL_CONFIG[signal.evaluator_type];
  const Icon = config.icon;
  const isHuman = signal.evaluator_type === 'human';

  return (
    <div className={`rounded-lg border-l-4 ${config.borderClass} bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.iconBgClass}`}>
            <Icon size={16} className={config.iconTextClass} />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {config.label}
            </span>
            {!isHuman && signal.score !== null && (
              <span className="ml-2 text-sm text-gray-500 dark:text-zinc-400">
                {signal.score.toFixed(1)} / {signal.max_score}
              </span>
            )}
            {isHuman && (
              <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">
                Qualitative only
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isHuman && signal.confidence !== null && (
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-zinc-700">
                <div
                  className="h-full rounded-full bg-gray-500 dark:bg-zinc-400"
                  style={{ width: `${(signal.confidence ?? 0) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-zinc-400">
                {((signal.confidence ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
          )}
          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-zinc-800 pt-3">
          {/* AI Signal: criteria breakdown */}
          {signal.evaluator_type === 'ai' && signal.criteria_scores && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Criteria Scores</p>
              {Object.entries(signal.criteria_scores).map(([criterion, data]: [string, any]) => {
                const score = typeof data === 'object' ? data.score : data;
                const maxScore = typeof data === 'object' ? data.max_score : signal.max_score;
                const percentage = maxScore ? Math.round((score / maxScore) * 100) : 0;
                const feedback = typeof data === 'object' ? data.feedback : null;
                return (
                  <div key={criterion} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-zinc-300">{criterion}</span>
                      <span className="text-gray-500 dark:text-zinc-400">{score}/{maxScore}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${
                          percentage >= 80 ? 'bg-emerald-500' :
                          percentage >= 60 ? 'bg-blue-500' :
                          percentage >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    {feedback && (
                      <p className="text-xs text-gray-500 dark:text-zinc-400">{typeof feedback === 'object' ? (feedback.correct || feedback.wrong) : feedback}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Embedding Signal: similarity + reference matches */}
          {signal.evaluator_type === 'embedding' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-zinc-400">Normalized Score</span>
                <span className="text-gray-900 dark:text-white">{((signal.normalized_score ?? 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-zinc-400">Confidence</span>
                <span className="text-gray-900 dark:text-white">{((signal.confidence ?? 0) * 100).toFixed(1)}%</span>
              </div>
              {signal.metadata && (
                <>
                  {signal.metadata.similarity_score !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-zinc-400">Cosine Similarity</span>
                      <span className="text-gray-900 dark:text-white">{(signal.metadata.similarity_score * 100).toFixed(1)}%</span>
                    </div>
                  )}
                  {signal.metadata.num_references !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-zinc-400">Reference Answers</span>
                      <span className="text-gray-900 dark:text-white">{signal.metadata.num_references}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Human Signal: feedback text */}
          {signal.evaluator_type === 'human' && (
            <div className="space-y-3">
              {signal.criteria_scores && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Per-Criterion Feedback</p>
                  {Object.entries(signal.criteria_scores).map(([criterion, feedback]) => (
                    <div key={criterion} className="space-y-0.5">
                      <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">{criterion}</span>
                      <p className="text-sm text-gray-600 dark:text-zinc-400">{String(feedback)}</p>
                    </div>
                  ))}
                </div>
              )}
              {signal.feedback && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Overall Feedback</p>
                  <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">{signal.feedback}</p>
                </div>
              )}
            </div>
          )}

          {/* Weight info for automated signals */}
          {!isHuman && signal.weight !== null && (
            <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-4 text-xs text-gray-500 dark:text-zinc-400">
              <span>Weight: {(signal.weight ?? 0).toFixed(2)}</span>
              {signal.evaluator_id && <span>Model: {signal.evaluator_id}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EvaluationDisplay({ evaluation, explanation, className = '' }: EvaluationDisplayProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const isPassing = evaluation.final_score !== null && evaluation.final_score >= evaluation.pass_score;
  const scorePercentage = evaluation.final_score !== null
    ? Math.round((evaluation.final_score / evaluation.max_score) * 100) : 0;

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Status Timeline */}
      <EvaluationStatusIndicator
        status={evaluation.status}
        timestamps={{ created_at: evaluation.created_at, updated_at: evaluation.updated_at }}
      />

      {/* Score Summary */}
      {evaluation.final_score !== null && (
        <div className="rounded-xl p-5 shadow-sm bg-white border border-gray-200 dark:bg-zinc-900 dark:border-transparent">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-zinc-400">Final Score</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-light text-gray-900 dark:text-white">
                  {evaluation.final_score.toFixed(1)}
                </span>
                <span className="text-lg text-gray-500 dark:text-zinc-400">
                  / {evaluation.max_score}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                Pass score: {evaluation.pass_score}
              </p>
            </div>
            <div className="flex flex-col items-center">
              {/* Circular progress */}
              <div className="w-16 h-16 rounded-full flex items-center justify-center relative">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-200 dark:stroke-zinc-800" strokeWidth="2" />
                  <circle
                    cx="18" cy="18" r="16" fill="none"
                    strokeDasharray="100"
                    strokeDashoffset={100 - scorePercentage}
                    className={`${
                      scorePercentage >= 80 ? 'stroke-emerald-500' :
                      scorePercentage >= 60 ? 'stroke-blue-500' :
                      scorePercentage >= 40 ? 'stroke-amber-500' : 'stroke-rose-500'
                    }`}
                    strokeWidth="2" strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-sm font-medium text-gray-900 dark:text-white">{scorePercentage}%</div>
              </div>
              <span className={`mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                isPassing
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
              }`}>
                {isPassing ? 'Pass' : 'Fail'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Signal Cards */}
      {evaluation.signals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300">Evaluation Signals</h3>
          {evaluation.signals.map(signal => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}

      {/* Explanation Toggle */}
      {explanation && (evaluation.status === 'provisional' || evaluation.status === 'final') && (
        <div>
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
          >
            {showExplanation ? 'Hide' : 'Show'} score explanation
            {showExplanation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showExplanation && (
            <div className="mt-3">
              <EvaluationExplanation explanation={explanation} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
