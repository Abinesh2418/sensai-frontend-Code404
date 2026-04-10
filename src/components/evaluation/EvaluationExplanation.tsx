"use client";

import React, { useState } from 'react';
import { EvaluationExplanationData, EvaluatorType } from '@/types/evaluation';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import Tooltip from '@/components/Tooltip';

interface EvaluationExplanationProps {
  explanation: EvaluationExplanationData;
  className?: string;
}

const EVALUATOR_STYLES: Record<EvaluatorType, { label: string; textClass: string; bgClass: string }> = {
  ai: { label: 'AI', textClass: 'text-blue-600 dark:text-blue-400', bgClass: 'bg-blue-50 dark:bg-blue-900/20' },
  embedding: { label: 'Embedding', textClass: 'text-emerald-600 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-900/20' },
  human: { label: 'Human', textClass: 'text-purple-600 dark:text-purple-400', bgClass: 'bg-purple-50 dark:bg-purple-900/20' },
};

export default function EvaluationExplanation({ explanation, className = '' }: EvaluationExplanationProps) {
  const [isFormulaExpanded, setIsFormulaExpanded] = useState(false);

  const automatedSignals = explanation.signals.filter(s => s.evaluator_type !== 'human');
  const humanSignal = explanation.signals.find(s => s.evaluator_type === 'human');

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Score Breakdown Header */}
      <div className="rounded-xl p-5 shadow-sm bg-white border border-gray-200 dark:bg-zinc-900 dark:border-transparent">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-light text-gray-900 dark:text-white">Score Breakdown</h3>
          <Tooltip content="Shows how each evaluator contributed to the final score" position="left">
            <Info size={16} className="text-gray-400 dark:text-zinc-500" />
          </Tooltip>
        </div>

        {/* Final Score */}
        <div className="flex items-baseline gap-2 mb-5">
          <span className="text-3xl font-light text-gray-900 dark:text-white">
            {explanation.final_score.toFixed(1)}
          </span>
          <span className="text-lg text-gray-500 dark:text-zinc-400">
            / {explanation.max_score}
          </span>
        </div>

        {/* Signal Contributions */}
        <div className="space-y-3">
          {automatedSignals.map((signal, index) => {
            const style = EVALUATOR_STYLES[signal.evaluator_type];
            const contribution = signal.contribution ?? 0;
            const contributionPercent = explanation.weight_confidence_sum > 0
              ? (contribution / explanation.weight_confidence_sum) * 100
              : 0;

            return (
              <div key={index} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bgClass} ${style.textClass}`}>
                      {style.label}
                    </span>
                    <span className="text-gray-600 dark:text-zinc-400">
                      {((signal.normalized_score ?? 0) * 100).toFixed(0)}% score
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-400">
                    <span>w: {(signal.weight ?? 0).toFixed(2)}</span>
                    <span>c: {((signal.confidence ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
                {/* Contribution bar */}
                <div className="w-full h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      signal.evaluator_type === 'ai' ? 'bg-blue-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(contributionPercent, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Formula Toggle */}
      <button
        onClick={() => setIsFormulaExpanded(!isFormulaExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
      >
        <span>Scoring formula</span>
        {isFormulaExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isFormulaExpanded && (
        <div className="px-4 py-3 rounded-lg bg-gray-50 dark:bg-zinc-800/50 text-sm font-mono text-gray-700 dark:text-zinc-300 overflow-x-auto">
          <p className="mb-2">final_score = (SUM(norm_score_i * weight_i * confidence_i) / SUM(weight_i * confidence_i)) * max_score</p>
          <p className="text-gray-500 dark:text-zinc-400">
            = ({explanation.weighted_sum.toFixed(4)} / {explanation.weight_confidence_sum.toFixed(4)}) * {explanation.max_score}
          </p>
          <p className="text-gray-900 dark:text-white font-medium mt-1">
            = {explanation.final_score.toFixed(2)}
          </p>
        </div>
      )}

      {/* Human Feedback Enrichment */}
      {(humanSignal || explanation.human_feedback) && (
        <div className="rounded-xl p-5 shadow-sm bg-white border border-gray-200 dark:bg-zinc-900 dark:border-transparent">
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${EVALUATOR_STYLES.human.bgClass} ${EVALUATOR_STYLES.human.textClass}`}>
              Mentor Feedback
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
            {explanation.human_feedback || 'Mentor feedback enriches the evaluation but does not affect the numerical score.'}
          </p>
        </div>
      )}
    </div>
  );
}
