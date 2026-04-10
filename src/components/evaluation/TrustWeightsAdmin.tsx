"use client";

import React, { useState, useEffect } from 'react';
import { useTrustWeights } from '@/lib/hooks/useTrustWeights';
import { Loader2, Save, AlertCircle, RotateCcw, Bot, Cpu, User } from 'lucide-react';
import Toast from '@/components/Toast';

interface TrustWeightsAdminProps {
  className?: string;
}

export default function TrustWeightsAdmin({ className = '' }: TrustWeightsAdminProps) {
  const { weights, isLoading, isSaving, error, saveWeights, refetch } = useTrustWeights();
  const [aiWeight, setAiWeight] = useState(0.50);
  const [embeddingWeight, setEmbeddingWeight] = useState(0.30);
  const [humanWeight, setHumanWeight] = useState(0.20);
  const [showToast, setShowToast] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync from fetched weights
  useEffect(() => {
    if (weights.length > 0) {
      const ai = weights.find(w => w.evaluator_type === 'ai');
      const emb = weights.find(w => w.evaluator_type === 'embedding');
      if (ai) setAiWeight(ai.trust_weight);
      if (emb) setEmbeddingWeight(emb.trust_weight);
      // Derive human weight from remainder
      const aiW = ai?.trust_weight ?? 0.50;
      const embW = emb?.trust_weight ?? 0.30;
      setHumanWeight(Math.round((1 - aiW - embW) * 100) / 100);
      setHasChanges(false);
    }
  }, [weights]);

  const redistribute = (changed: 'ai' | 'embedding' | 'human', value: number) => {
    const clamped = Math.max(0.05, Math.min(0.90, value));
    const remaining = Math.round((1 - clamped) * 100) / 100;

    if (changed === 'ai') {
      setAiWeight(clamped);
      // Split remaining between embedding and human proportionally
      const ratio = embeddingWeight + humanWeight > 0
        ? embeddingWeight / (embeddingWeight + humanWeight) : 0.6;
      setEmbeddingWeight(Math.round(remaining * ratio * 100) / 100);
      setHumanWeight(Math.round(remaining * (1 - ratio) * 100) / 100);
    } else if (changed === 'embedding') {
      setEmbeddingWeight(clamped);
      const ratio = aiWeight + humanWeight > 0
        ? aiWeight / (aiWeight + humanWeight) : 0.7;
      setAiWeight(Math.round(remaining * ratio * 100) / 100);
      setHumanWeight(Math.round(remaining * (1 - ratio) * 100) / 100);
    } else {
      setHumanWeight(clamped);
      const ratio = aiWeight + embeddingWeight > 0
        ? aiWeight / (aiWeight + embeddingWeight) : 0.6;
      setAiWeight(Math.round(remaining * ratio * 100) / 100);
      setEmbeddingWeight(Math.round(remaining * (1 - ratio) * 100) / 100);
    }
    setHasChanges(true);
  };

  const handleSave = async () => {
    const success = await saveWeights({ ai: aiWeight, embedding: embeddingWeight });
    if (success) {
      setShowToast(true);
      setHasChanges(false);
      setTimeout(() => setShowToast(false), 4000);
    }
  };

  const handleReset = () => {
    refetch();
    setHasChanges(false);
  };

  const aiTrust = weights.find(w => w.evaluator_type === 'ai');
  const embTrust = weights.find(w => w.evaluator_type === 'embedding');

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader2 size={24} className="animate-spin text-gray-400 dark:text-zinc-500" />
      </div>
    );
  }

  const sliders: { key: 'ai' | 'embedding' | 'human'; label: string; value: number; icon: React.ElementType; color: string; accentClass: string }[] = [
    { key: 'ai', label: 'AI Evaluator', value: aiWeight, icon: Bot, color: 'blue', accentClass: 'accent-blue-500' },
    { key: 'embedding', label: 'Embedding Evaluator', value: embeddingWeight, icon: Cpu, color: 'emerald', accentClass: 'accent-emerald-500' },
    { key: 'human', label: 'Mentor Feedback', value: humanWeight, icon: User, color: 'purple', accentClass: 'accent-purple-500' },
  ];

  return (
    <div className={`space-y-5 ${className}`}>
      <div>
        <h2 className="text-lg font-light text-gray-900 dark:text-white">Trust Weights</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Configure how each evaluator signal contributes to the final score. Weights must sum to 100%.
        </p>
      </div>

      {/* Weight Controls */}
      <div className="rounded-xl p-5 shadow-sm bg-white border border-gray-200 dark:bg-zinc-900 dark:border-transparent space-y-5">
        {sliders.map(({ key, label, value, icon: Icon, color, accentClass }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-${color}-50 dark:bg-${color}-900/20`}>
                  <Icon size={14} className={`text-${color}-600 dark:text-${color}-400`} />
                </div>
                <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                  {label}
                </label>
              </div>
              <span className="text-sm text-gray-900 dark:text-white font-medium">{(value * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.90"
              step="0.05"
              value={value}
              onChange={(e) => redistribute(key, parseFloat(e.target.value))}
              className={`w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 ${accentClass}`}
            />
          </div>
        ))}

        {/* Visual weight distribution */}
        <div className="space-y-1.5 pt-2">
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Weight Distribution</p>
          <div className="flex h-3 rounded-full overflow-hidden">
            <div className="bg-blue-500 transition-all duration-300" style={{ width: `${aiWeight * 100}%` }} />
            <div className="bg-emerald-500 transition-all duration-300" style={{ width: `${embeddingWeight * 100}%` }} />
            <div className="bg-purple-500 transition-all duration-300" style={{ width: `${humanWeight * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-600 dark:text-blue-400">AI ({(aiWeight * 100).toFixed(0)}%)</span>
            <span className="text-emerald-600 dark:text-emerald-400">Embedding ({(embeddingWeight * 100).toFixed(0)}%)</span>
            <span className="text-purple-600 dark:text-purple-400">Mentor ({(humanWeight * 100).toFixed(0)}%)</span>
          </div>
        </div>
      </div>

      {/* How scoring works */}
      <div className="rounded-xl p-5 shadow-sm bg-white border border-gray-200 dark:bg-zinc-900 dark:border-transparent">
        <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">How Final Scoring Works</h3>
        <div className="space-y-3 text-sm text-gray-600 dark:text-zinc-400">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium flex-shrink-0 mt-0.5">1</span>
            <p>Student submits an answer → <strong className="text-gray-900 dark:text-white">AI</strong> and <strong className="text-gray-900 dark:text-white">Embedding</strong> evaluators score it instantly → status becomes <span className="text-blue-600 dark:text-blue-400 font-medium">Provisional</span></p>
          </div>
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium flex-shrink-0 mt-0.5">2</span>
            <p>Mentor reviews and submits feedback → all three signals are combined using the weights above</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex-shrink-0 mt-0.5">3</span>
            <p>Final score is computed and status becomes <span className="text-emerald-600 dark:text-emerald-400 font-medium">Final</span> — only after mentor review is complete</p>
          </div>
        </div>
      </div>

      {/* Agreement Metrics */}
      {(aiTrust || embTrust) && (
        <div className="rounded-xl p-5 shadow-sm bg-white border border-gray-200 dark:bg-zinc-900 dark:border-transparent">
          <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-4">Agreement Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            {aiTrust && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-zinc-400">AI Evaluator</p>
                <p className="text-lg font-light text-gray-900 dark:text-white">
                  {aiTrust.total_evaluations > 0
                    ? ((aiTrust.total_agreements / aiTrust.total_evaluations) * 100).toFixed(1)
                    : '0.0'}%
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  {aiTrust.total_agreements.toFixed(1)} / {aiTrust.total_evaluations} evaluations
                </p>
              </div>
            )}
            {embTrust && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Embedding Evaluator</p>
                <p className="text-lg font-light text-gray-900 dark:text-white">
                  {embTrust.total_evaluations > 0
                    ? ((embTrust.total_agreements / embTrust.total_evaluations) * 100).toFixed(1)
                    : '0.0'}%
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  {embTrust.total_agreements.toFixed(1)} / {embTrust.total_evaluations} evaluations
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-sm text-rose-700 dark:text-rose-400">
          <AlertCircle size={16} />
          <span>{error.message}</span>
        </div>
      )}

      {/* Actions */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              isSaving
                ? 'bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400 cursor-not-allowed'
                : 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
            }`}
          >
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {isSaving ? 'Saving...' : 'Save Weights'}
          </button>
        </div>
      )}

      <Toast
        show={showToast}
        title="Saved"
        description="Trust weights updated successfully"
        emoji="✓"
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
