"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import {
  ArrowLeft, Loader2, ChevronDown, ChevronUp,
  Bot, Cpu, Search, AlertTriangle, CheckCircle2, CheckCircle, Circle, MinusCircle,
} from "lucide-react";
import { useThemePreference } from "@/lib/hooks/useThemePreference";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

type StepKey = "keyword" | "semantic" | "confidence_gate" | "llm";
type StepStatus = "pending" | "running" | "done" | "skipped";

interface StepInfo { status: StepStatus; summary?: string; }

interface QuestionLiveProgress {
  q_title: string;
  keyword: StepInfo;
  semantic: StepInfo;
  confidence_gate: StepInfo;
  llm: StepInfo;
  done: boolean;
}

interface KeywordResult {
  score: number; coverage: number;
  matched_keywords?: string[]; missing_keywords?: string[];
  matched_count?: number; total_reference_keywords?: number;
}

interface TierSignal {
  score: number | null; max_score: number | null;
  normalized_score: number | null; confidence: number | null;
  model?: string; feedback?: string;
  criteria_scores?: Record<string, any>;
}

interface QuestionAnalysis {
  question_id: number; question_title: string;
  evaluation_id?: number; status: string;
  final_score?: number; max_score?: number; pass_score?: number; passed?: boolean;
  tiers: {
    tier_1?: { keyword_matching?: KeywordResult; semantic_similarity?: TierSignal };
    tier_2?: { llm_evaluation?: TierSignal; included_in_aggregation?: boolean };
  };
  aggregation?: any;
  confidence_gate?: { tier1_weighted_score: number; decision: string; human_review_recommended: boolean };
  disagreements?: any[];
}

interface EngineResult {
  user_id: number; user_name: string; task_id: number; task_title: string;
  overall: { final_score: number; max_score: number; percentage: number; questions_evaluated: number; total_questions: number };
  disagreements: any[];
  questions: QuestionAnalysis[];
}

type QuestionReview = { Understanding: number; Application: number; Clarity: number };

// ─── Component ────────────────────────────────────────────────────────────────

const STEPS: { key: StepKey; label: string; Icon: React.ElementType }[] = [
  { key: "keyword",         label: "Keyword Matching",    Icon: Search },
  { key: "semantic",        label: "Semantic Similarity",  Icon: Cpu },
  { key: "confidence_gate", label: "Confidence Gate",      Icon: Circle },
  { key: "llm",             label: "LLM Evaluation",       Icon: Bot },
];

export default function EvaluationDetailPage() {
  useThemePreference();
  const params = useParams();
  const router = useRouter();
  const userId  = params.userId  as string;
  const taskId  = params.taskId  as string;

  const [result, setResult]               = useState<EngineResult | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [expandedQ, setExpandedQ]         = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewData, setPreviewData]     = useState<{ user_name: string; task_title: string; question_count: number } | null>(null);
  const [liveProgress, setLiveProgress]   = useState<QuestionLiveProgress[]>([]);

  // Mentor review — keyed by evaluation_id
  const [questionReviews,    setQuestionReviews]    = useState<Record<number, QuestionReview>>({});
  const [questionFeedback,   setQuestionFeedback]   = useState<Record<number, string>>({});
  const [questionSubmitting, setQuestionSubmitting] = useState<Record<number, boolean>>({});
  const [questionSubmitted,  setQuestionSubmitted]  = useState<Record<number, boolean>>({});
  const [questionErrors,     setQuestionErrors]     = useState<Record<number, string>>({});

  // Load preview info
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/evaluations/review/pending`);
        if (!res.ok) throw new Error();
        const reviews = await res.json();
        const matching = reviews.filter((r: any) => String(r.user_id) === userId && String(r.task_id) === taskId);
        if (matching.length > 0) {
          setPreviewData({ user_name: matching[0].user_name, task_title: matching[0].task_title, question_count: matching.length });
        }
      } catch { /* ignore */ }
      setPreviewLoading(false);
    })();
  }, [userId, taskId]);

  // Init per-question defaults when results arrive
  useEffect(() => {
    if (result) {
      const scores: Record<number, QuestionReview> = {};
      const feedback: Record<number, string> = {};
      for (const q of result.questions) {
        if (q.evaluation_id) {
          scores[q.evaluation_id]   = { Understanding: 8, Application: 8, Clarity: 8 };
          feedback[q.evaluation_id] = "";
        }
      }
      setQuestionReviews(scores);
      setQuestionFeedback(feedback);
    }
  }, [result]);

  // ── Run engine with SSE streaming ──────────────────────────────────────────
  const runEngine = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLiveProgress([]);
    try {
      const res = await fetch(`${BACKEND_URL}/evaluations/run-engine/${userId}/${taskId}`, { method: "POST" });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ detail: "Engine failed" }));
        throw new Error(err.detail || "Evaluation engine failed");
      }
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop()!;

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.event === "step") {
              setLiveProgress(prev => {
                const next = [...prev];
                while (next.length <= data.q_idx) {
                  next.push({ q_title: "", keyword: { status: "pending" }, semantic: { status: "pending" }, confidence_gate: { status: "pending" }, llm: { status: "pending" }, done: false });
                }
                const q = { ...next[data.q_idx] };
                if (data.q_title) q.q_title = data.q_title;
                (q as any)[data.step] = { status: data.status, summary: data.summary };
                next[data.q_idx] = q;
                return next;
              });

            } else if (data.event === "question_done") {
              setLiveProgress(prev => {
                const next = [...prev];
                if (next[data.q_idx]) next[data.q_idx] = { ...next[data.q_idx], done: true };
                return next;
              });

            } else if (data.event === "complete") {
              setResult(data.result);
              setLoading(false);
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }, [userId, taskId]);

  // ── Submit review for a single question ───────────────────────────────────
  const submitQuestionReview = async (evalId: number) => {
    const feedback = questionFeedback[evalId]?.trim();
    if (!feedback) return;
    setQuestionSubmitting(prev => ({ ...prev, [evalId]: true }));
    setQuestionErrors(prev => ({ ...prev, [evalId]: "" }));
    try {
      const scores = questionReviews[evalId] ?? { Understanding: 8, Application: 8, Clarity: 8 };
      const res = await fetch(`${BACKEND_URL}/evaluations/${evalId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewer_user_id: 0, criteria_scores: scores, max_score_per_criterion: 10.0, overall_feedback: feedback }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed" }));
        throw new Error(err.detail || "Submission failed");
      }
      setQuestionSubmitted(prev => ({ ...prev, [evalId]: true }));
    } catch (e: any) {
      setQuestionErrors(prev => ({ ...prev, [evalId]: e.message || "Failed to submit" }));
    } finally {
      setQuestionSubmitting(prev => ({ ...prev, [evalId]: false }));
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const scoreColor = (pct: number) =>
    pct >= 80 ? "text-emerald-600 dark:text-emerald-400" :
    pct >= 60 ? "text-blue-600 dark:text-blue-400" :
    pct >= 40 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";

  const barColor = (pct: number) =>
    pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500";

  const StepIcon = ({ status }: { status: StepStatus }) => {
    if (status === "running") return <Loader2   size={14} className="animate-spin text-blue-500 flex-shrink-0" />;
    if (status === "done")    return <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />;
    if (status === "skipped") return <MinusCircle size={14} className="text-gray-400 dark:text-zinc-500 flex-shrink-0" />;
    return <Circle size={14} className="text-gray-300 dark:text-zinc-700 flex-shrink-0" />;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <Header showCreateCourseButton={false} userRole="Mentor" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 mb-6 cursor-pointer">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {/* ── PRE-RUN ── */}
        {!result && !loading && (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 p-8 text-center">
            {previewLoading ? (
              <Loader2 size={24} className="animate-spin mx-auto text-gray-400" />
            ) : (
              <>
                <h1 className="text-2xl font-light text-gray-900 dark:text-white mb-2">
                  {previewData?.task_title || "Assessment"}
                </h1>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mb-1">
                  Learner: <span className="font-medium text-gray-700 dark:text-zinc-300">{previewData?.user_name || `User ${userId}`}</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8">
                  {previewData?.question_count || 0} questions to evaluate
                </p>
                <button onClick={runEngine} className="px-8 py-3 rounded-full text-sm font-medium bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors cursor-pointer">
                  Run Evaluation Engine
                </button>
                {error && <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
              </>
            )}
          </div>
        )}

        {/* ── LIVE PROGRESS ── */}
        {loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 size={18} className="animate-spin text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-zinc-400">Running multi-tier evaluation engine...</span>
              <span className="text-xs text-gray-400 dark:text-zinc-500 ml-auto">{liveProgress.filter(q => q.done).length}/{liveProgress.length} done</span>
            </div>

            {liveProgress.map((q, idx) => (
              <div key={idx} className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                {/* Question header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                      q.done
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}>{idx + 1}</div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{q.q_title || `Question ${idx + 1}`}</span>
                  </div>
                  {q.done
                    ? <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    : <Loader2 size={16} className="animate-spin text-blue-400 flex-shrink-0" />}
                </div>

                {/* Steps */}
                <div className="space-y-2.5 pl-10">
                  {STEPS.map(({ key, label }) => {
                    const step = q[key];
                    return (
                      <div key={key} className="flex items-center gap-2.5">
                        <StepIcon status={step.status} />
                        <span className={`text-xs ${
                          step.status === "running"  ? "text-blue-600 dark:text-blue-400 font-medium" :
                          step.status === "done"     ? "text-gray-700 dark:text-zinc-300" :
                          step.status === "skipped"  ? "text-gray-400 dark:text-zinc-500" :
                          "text-gray-300 dark:text-zinc-600"
                        }`}>{label}</span>
                        {step.status === "running" && (
                          <span className="text-xs text-blue-400 dark:text-blue-500 ml-auto animate-pulse">running…</span>
                        )}
                        {step.summary && step.status !== "running" && (
                          <span className="text-xs text-gray-400 dark:text-zinc-500 ml-auto truncate max-w-56">{step.summary}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── RESULTS ── */}
        {result && (
          <div className="space-y-6">

            {/* Overall summary */}
            <div className="rounded-xl p-6 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-light text-gray-900 dark:text-white">{result.task_title}</h1>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                    Evaluated for <span className="font-medium text-gray-700 dark:text-zinc-300">{result.user_name}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-light text-gray-900 dark:text-white">
                    {result.overall.final_score.toFixed(1)}<span className="text-xl text-gray-400">/{result.overall.max_score}</span>
                  </div>
                  <div className={`text-sm font-semibold mt-1 ${scoreColor(result.overall.percentage)}`}>{result.overall.percentage}%</div>
                </div>
              </div>
              <div className="mt-4 w-full h-2 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
                <div className={`h-full rounded-full ${barColor(result.overall.percentage)}`} style={{ width: `${result.overall.percentage}%` }} />
              </div>
              <div className="mt-3 flex gap-6 text-xs text-gray-400 dark:text-zinc-500">
                <span>{result.overall.questions_evaluated}/{result.overall.total_questions} questions evaluated</span>
                <span>Weights: Keyword 15% · Semantic 25% · LLM 60%</span>
              </div>
            </div>

            {/* Disagreements */}
            {result.disagreements.length > 0 && (
              <div className="rounded-xl p-5 border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {result.disagreements.length} Evaluator Disagreement{result.disagreements.length !== 1 ? "s" : ""} Detected
                  </h3>
                </div>
                {result.disagreements.map((d, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-medium">{d.question_title}</span>: {d.evaluator_a} ({(d.score_a * 100).toFixed(0)}%) vs {d.evaluator_b} ({(d.score_b * 100).toFixed(0)}%) — {d.severity} ({(d.diff * 100).toFixed(0)}% gap)
                  </p>
                ))}
              </div>
            )}

            {/* Per-question accordion */}
            <h2 className="text-lg font-light text-gray-900 dark:text-white">Detailed Question Analysis</h2>
            <div className="space-y-3">
              {result.questions.map((q, idx) => {
                if (q.status === "no_answer") return (
                  <div key={q.question_id} className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 p-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center text-sm text-gray-400">{idx + 1}</div>
                    <div>
                      <p className="text-sm text-gray-700 dark:text-zinc-300">{q.question_title}</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500">No answer submitted</p>
                    </div>
                  </div>
                );

                const isExpanded = expandedQ === idx;
                const qPct = q.max_score && q.final_score != null ? Math.round((q.final_score / q.max_score) * 100) : 0;
                const t1   = q.tiers.tier_1;
                const t2   = q.tiers.tier_2;
                const gate = q.confidence_gate;
                const evalId  = q.evaluation_id;
                const qReview = evalId ? (questionReviews[evalId] ?? { Understanding: 8, Application: 8, Clarity: 8 }) : null;

                return (
                  <div key={q.question_id} className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                    {/* Header row */}
                    <button onClick={() => setExpandedQ(isExpanded ? null : idx)} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center gap-3 text-left">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                          qPct >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          qPct >= 60 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}>{idx + 1}</div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{q.question_title}</p>
                          <p className="text-xs text-gray-400 dark:text-zinc-500">{q.final_score?.toFixed(1)} / {q.max_score} · {q.passed ? "Passed" : "Below pass score"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-light ${scoreColor(qPct)}`}>{qPct}%</span>
                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-5 border-t border-gray-100 dark:border-zinc-800 pt-4 space-y-5">

                        {/* Tier 1 */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Search size={12} /> Tier 1 — Fast Evaluators
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {t1?.keyword_matching && (
                              <div className="rounded-lg p-4 border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Keyword Matching</span>
                                  <span className={`text-sm font-medium ${scoreColor(t1.keyword_matching.coverage * 100)}`}>{(t1.keyword_matching.coverage * 100).toFixed(0)}%</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 mb-2">
                                  <div className={`h-full rounded-full ${barColor(t1.keyword_matching.coverage * 100)}`} style={{ width: `${t1.keyword_matching.coverage * 100}%` }} />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-zinc-400">{t1.keyword_matching.matched_count}/{t1.keyword_matching.total_reference_keywords} keywords matched</p>
                                {t1.keyword_matching.missing_keywords && t1.keyword_matching.missing_keywords.length > 0 && (
                                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Missing: <span className="text-rose-500">{t1.keyword_matching.missing_keywords.slice(0, 5).join(", ")}</span></p>
                                )}
                              </div>
                            )}
                            {t1?.semantic_similarity && (
                              <div className="rounded-lg p-4 border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 flex items-center gap-1.5"><Cpu size={12} className="text-emerald-500" /> Semantic Similarity</span>
                                  <span className={`text-sm font-medium ${scoreColor((t1.semantic_similarity.normalized_score || 0) * 100)}`}>{((t1.semantic_similarity.normalized_score || 0) * 100).toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 mb-2">
                                  <div className={`h-full rounded-full ${barColor((t1.semantic_similarity.normalized_score || 0) * 100)}`} style={{ width: `${(t1.semantic_similarity.normalized_score || 0) * 100}%` }} />
                                </div>
                                <div className="flex gap-4 text-xs text-gray-500 dark:text-zinc-400">
                                  <span>Score: {t1.semantic_similarity.score?.toFixed(1)}/{t1.semantic_similarity.max_score}</span>
                                  <span>Model: {t1.semantic_similarity.model}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Confidence Gate */}
                        {gate && (
                          <div className={`rounded-lg px-4 py-3 border text-sm flex items-center justify-between ${
                            gate.decision === "skip_llm"
                              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/10"
                              : "border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-900/10"
                          }`}>
                            <div>
                              <span className="font-medium text-gray-700 dark:text-zinc-300">Confidence Gate: </span>
                              <span className={gate.decision === "skip_llm" ? "text-emerald-700 dark:text-emerald-400" : "text-blue-700 dark:text-blue-400"}>
                                {gate.decision === "skip_llm" ? "Tier-1 sufficient — LLM skipped" : "Proceeding to LLM evaluation"}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-zinc-400">Tier-1 score: {(gate.tier1_weighted_score * 100).toFixed(0)}%</span>
                          </div>
                        )}

                        {/* Tier 2 — LLM */}
                        {t2?.llm_evaluation && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <Bot size={12} /> Tier 2 — LLM Evaluation
                            </h4>
                            <div className="rounded-lg p-4 border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">{t2.llm_evaluation.model}</span>
                                <span className={`text-sm font-medium ${scoreColor((t2.llm_evaluation.normalized_score || 0) * 100)}`}>
                                  {t2.llm_evaluation.score?.toFixed(1)}/{t2.llm_evaluation.max_score} ({((t2.llm_evaluation.normalized_score || 0) * 100).toFixed(0)}%)
                                </span>
                              </div>
                              {t2.llm_evaluation.criteria_scores && (
                                <div className="space-y-2 mb-3">
                                  {Object.entries(t2.llm_evaluation.criteria_scores).map(([name, data]: [string, any]) => {
                                    const s = typeof data === "object" ? data.score : data;
                                    const m = typeof data === "object" ? data.max_score : t2.llm_evaluation!.max_score;
                                    const p = m ? Math.round((s / m) * 100) : 0;
                                    const fb = typeof data === "object" ? data.feedback : null;
                                    return (
                                      <div key={name}>
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-700 dark:text-zinc-300">{name}</span>
                                          <span className="text-gray-500 dark:text-zinc-400">{s}/{m}</span>
                                        </div>
                                        <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 mt-1">
                                          <div className={`h-full rounded-full ${barColor(p)}`} style={{ width: `${p}%` }} />
                                        </div>
                                        {fb && <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{typeof fb === "object" ? (fb.correct || fb.wrong || "") : fb}</p>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {t2.llm_evaluation.feedback && (
                                <div className="pt-3 border-t border-gray-200 dark:border-zinc-700">
                                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">AI Feedback</p>
                                  <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">{t2.llm_evaluation.feedback}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Disagreements for this question */}
                        {q.disagreements && q.disagreements.length > 0 && (
                          <div className="rounded-lg p-3 border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10">
                            <div className="flex items-center gap-1.5 mb-1">
                              <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
                              <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Evaluator Disagreement</span>
                            </div>
                            {q.disagreements.map((d: any, i: number) => (
                              <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                                {d.evaluator_a} vs {d.evaluator_b}: {(d.diff * 100).toFixed(0)}% gap ({d.severity})
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Per-question Mentor Review */}
                        {evalId && qReview && (
                          <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                            {questionSubmitted[evalId] ? (
                              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={16} />
                                <span className="text-sm font-medium">Mentor review submitted</span>
                              </div>
                            ) : (
                              <>
                                <h5 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                                  Mentor Review — this question
                                </h5>

                                {/* Sliders */}
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                  {(["Understanding", "Application", "Clarity"] as const).map(criterion => {
                                    const score = qReview[criterion];
                                    return (
                                      <div key={criterion}>
                                        <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">{criterion}</label>
                                        <div className="flex items-center gap-2 mt-1.5">
                                          <input
                                            type="range" min={0} max={10} step={0.5}
                                            value={score}
                                            onChange={e => setQuestionReviews(prev => ({
                                              ...prev,
                                              [evalId]: { ...qReview, [criterion]: parseFloat(e.target.value) },
                                            }))}
                                            className="flex-1 h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-zinc-700 cursor-pointer"
                                          />
                                          <span className={`text-xs font-semibold w-6 text-right ${scoreColor(score * 10)}`}>{score}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-xs text-gray-400 dark:text-zinc-500 mb-3">
                                  Score: {Object.values(qReview).reduce((a, b) => a + b, 0).toFixed(1)}/30 ({Math.round(Object.values(qReview).reduce((a, b) => a + b, 0) / 30 * 100)}%) · Weight: 35%
                                </p>

                                {/* Feedback textarea */}
                                <textarea
                                  value={questionFeedback[evalId] ?? ""}
                                  onChange={e => setQuestionFeedback(prev => ({ ...prev, [evalId]: e.target.value }))}
                                  placeholder="Specific feedback for this question..."
                                  rows={3}
                                  className="w-full px-3 py-2.5 rounded-lg text-sm border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-zinc-600 resize-none mb-3"
                                />

                                {questionErrors[evalId] && (
                                  <p className="text-xs text-rose-600 dark:text-rose-400 mb-2">{questionErrors[evalId]}</p>
                                )}

                                <button
                                  onClick={() => submitQuestionReview(evalId)}
                                  disabled={questionSubmitting[evalId] || !(questionFeedback[evalId]?.trim())}
                                  className={`px-5 py-2 rounded-full text-xs font-medium transition-colors ${
                                    questionSubmitting[evalId] || !(questionFeedback[evalId]?.trim())
                                      ? "bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400 cursor-not-allowed"
                                      : "bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 cursor-pointer"
                                  }`}
                                >
                                  {questionSubmitting[evalId]
                                    ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Submitting…</span>
                                    : "Submit Review (35% weight)"}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Review status summary ── */}
            {(() => {
              const reviewable = result.questions.filter(q => q.evaluation_id);
              const submittedCount = reviewable.filter(q => questionSubmitted[q.evaluation_id!]).length;
              const allDone = submittedCount === reviewable.length && reviewable.length > 0;
              return (
                <div className={`rounded-xl p-5 border flex items-center justify-between ${
                  allDone
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-900/10"
                    : "border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900"
                }`}>
                  <div className="flex items-center gap-3">
                    {allDone
                      ? <CheckCircle2 size={18} className="text-emerald-500" />
                      : <Circle size={18} className="text-gray-400" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {allDone ? "All questions reviewed" : `${submittedCount} / ${reviewable.length} questions reviewed`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400">
                        {allDone
                          ? "Mentor scores (35% weight) applied to all questions"
                          : "Expand each question above to add scores and feedback"}
                      </p>
                    </div>
                  </div>
                  {submittedCount > 0 && (
                    <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                      {submittedCount}/{reviewable.length} submitted
                    </span>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-center pt-4">
              <button onClick={() => router.back()} className="px-6 py-2 rounded-full text-sm font-medium bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 cursor-pointer">
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
