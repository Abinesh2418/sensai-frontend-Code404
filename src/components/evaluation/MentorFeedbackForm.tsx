"use client";

import React, { useState } from 'react';
import { Evaluation, SubmitHumanFeedbackRequest } from '@/types/evaluation';
import { useSubmitFeedback } from '@/lib/hooks/useSubmitFeedback';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import Toast from '@/components/Toast';

interface MentorFeedbackFormProps {
  evaluation: Evaluation;
  criteriaNames?: string[];
  onSubmitSuccess?: (updatedEvaluation: Evaluation) => void;
  className?: string;
}

export default function MentorFeedbackForm({
  evaluation,
  criteriaNames = [],
  onSubmitSuccess,
  className = '',
}: MentorFeedbackFormProps) {
  const { submit, isSubmitting, error } = useSubmitFeedback();
  const [criteriaFeedback, setCriteriaFeedback] = useState<Record<string, string>>(
    Object.fromEntries(criteriaNames.map(name => [name, '']))
  );
  const [overallFeedback, setOverallFeedback] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Derive criteria names from AI signal if not provided
  const derivedCriteria = criteriaNames.length > 0
    ? criteriaNames
    : (() => {
        const aiSignal = evaluation.signals.find(s => s.evaluator_type === 'ai');
        if (aiSignal?.criteria_scores) {
          return Object.keys(aiSignal.criteria_scores);
        }
        return [];
      })();

  const handleCriterionChange = (criterion: string, value: string) => {
    setCriteriaFeedback(prev => ({ ...prev, [criterion]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const feedback: SubmitHumanFeedbackRequest = {
      feedback: overallFeedback,
      criteria_feedback: criteriaFeedback,
    };

    try {
      const result = await submit(evaluation.id, feedback);
      setIsSubmitted(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
      if (result && onSubmitSuccess) {
        onSubmitSuccess(result);
      }
    } catch {
      // Error handled by hook
    }
  };

  if (isSubmitted) {
    return (
      <div className={`rounded-xl p-8 text-center bg-white border border-gray-200 dark:bg-zinc-900 dark:border-transparent ${className}`}>
        <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
        <h3 className="text-lg font-light text-gray-900 dark:text-white mb-1">Feedback Submitted</h3>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          Your qualitative feedback has been recorded. The evaluation status has been updated to final.
        </p>
        <Toast
          show={showToast}
          title="Success"
          description="Mentor feedback submitted successfully"
          emoji="✓"
          onClose={() => setShowToast(false)}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-5 ${className}`}>
      <div className="rounded-xl p-5 shadow-sm bg-white border border-gray-200 dark:bg-zinc-900 dark:border-transparent">
        <h3 className="text-lg font-light text-gray-900 dark:text-white mb-1">Mentor Review</h3>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-5">
          Provide qualitative feedback for each criterion. Mentor feedback does not affect the numerical score.
        </p>

        {/* Per-criterion feedback */}
        {derivedCriteria.length > 0 && (
          <div className="space-y-4 mb-6">
            {derivedCriteria.map(criterion => (
              <div key={criterion}>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                  {criterion}
                </label>
                <textarea
                  value={criteriaFeedback[criterion] || ''}
                  onChange={(e) => handleCriterionChange(criterion, e.target.value)}
                  placeholder={`Feedback for ${criterion}...`}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-zinc-600 resize-none"
                />
              </div>
            ))}
          </div>
        )}

        {/* Overall feedback */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
            Overall Feedback
          </label>
          <textarea
            value={overallFeedback}
            onChange={(e) => setOverallFeedback(e.target.value)}
            placeholder="Provide overall feedback for the student..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-zinc-600 resize-none"
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-sm text-rose-700 dark:text-rose-400">
          <AlertCircle size={16} />
          <span>{error.message}</span>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || !overallFeedback.trim()}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
            isSubmitting || !overallFeedback.trim()
              ? 'bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400 cursor-not-allowed'
              : 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Submitting...
            </span>
          ) : (
            'Submit Feedback'
          )}
        </button>
      </div>
    </form>
  );
}
