"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Cpu, User, Loader2, CheckCircle2, ChevronDown, ChevronUp, Send, Play } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const MOCK_ANSWERS: Record<number, string> = {
  1: "HyperVerge is an AI company that specializes in identity verification and KYC automation. They use deep learning and computer vision to verify documents, match faces, and detect liveness. Founded in India, they serve fintech, banking, and insurance clients globally, reducing onboarding time from days to seconds.",
  2: "HyperVerge uses computer vision for document OCR, deep learning CNNs for face recognition with 99.5% accuracy, and liveness detection to prevent spoofing attacks. These work in a pipeline where a document is scanned, text extracted, face matched to selfie, and liveness verified.",
  3: "Before HyperVerge, KYC took 2-5 days with manual verification and 40-60% drop-off. After implementing HyperVerge, the process takes under 60 seconds with automated document verification, face matching, and liveness detection, reducing drop-off to under 10%.",
  4: "The face recognition uses face detection to locate faces, alignment to normalize pose, a CNN to extract embedding vectors, and cosine similarity for matching. It's robust due to diverse training data across demographics and data augmentation for lighting and angles.",
  5: "Liveness detection checks if a real person is present, not a photo or video. It prevents print attacks, screen replay attacks, and 3D mask attacks. HyperVerge uses both passive and active approaches.",
  6: "The OCR pipeline detects documents, classifies them, pre-processes images, extracts text using OCR and deep learning, then parses fields. Challenges include poor image quality, glare, and diverse formats which they handle through augmented training data.",
  7: "HyperVerge can be used in insurance for claims automation by analyzing damage photos, underwriting risk assessment by analyzing property and medical documents, and agent verification using face recognition to prevent imposters from selling fake policies.",
  8: "HyperVerge complies with GDPR for Europe, India's DPDP Act, has SOC 2 Type II and ISO 27001 certifications. They encrypt all biometric data, process data in-region, and offer both cloud and on-premise deployment options.",
  9: "Main competitors are Jumio, Onfido, and IDnow. HyperVerge differentiates with superior accuracy on Asian/African documents, sub-3-second processing, flexible deployment options, and competitive pricing for emerging markets.",
  10: "The future includes deepfake detection requiring multi-modal verification, decentralized identity with blockchain credentials, stricter regulations like the EU AI Act, continuous authentication via behavioral biometrics, and edge AI running models on mobile devices.",
};

interface Question { id: number; title: string; blocks: any[]; answer: any[]; }
interface Signal { evaluator_type: string; evaluator_id: string; score: number | null; max_score: number | null; normalized_score: number | null; confidence: number | null; criteria_scores: any; feedback: string | null; metadata: any; }
interface EvalResult { id: number; status: string; final_score: number | null; max_score: number; pass_score: number; signals: Signal[]; explanation: any; }
interface QEval { evaluationId: number; questionId: number; result: EvalResult | null; }

function extractText(blocks: any[]): string {
  if (!blocks) return '';
  return blocks.map(b => (b.content || []).map((c: any) => c.text || '').join('')).join(' ');
}

const SIGNAL_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  ai: { label: 'AI Evaluator', icon: Bot, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-l-blue-500' },
  embedding: { label: 'Semantic Evaluator', icon: Cpu, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-l-emerald-500' },
  human: { label: 'Human Feedback', icon: User, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-l-purple-500' },
};

function SignalCard({ signal }: { signal: Signal }) {
  const [expanded, setExpanded] = useState(false);
  const config = SIGNAL_CONFIG[signal.evaluator_type] || SIGNAL_CONFIG.ai;
  const Icon = config.icon;
  return (
    <div className={`rounded-lg border-l-4 ${config.border} bg-white dark:bg-zinc-900 shadow-sm border border-gray-200 dark:border-zinc-800`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${config.bg}`}><Icon size={14} className={config.color} /></div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{config.label}</span>
          {signal.score !== null && <span className="text-sm text-gray-500">{signal.score.toFixed(1)}/{signal.max_score}</span>}
          {signal.evaluator_type === 'human' && signal.score === null && <span className="text-xs text-purple-500">Qualitative</span>}
        </div>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-zinc-800 pt-2 text-sm">
          {signal.criteria_scores && Object.entries(signal.criteria_scores).map(([name, data]: [string, any]) => {
            const score = typeof data === 'object' ? data.score : null;
            const maxS = typeof data === 'object' ? data.max_score : 10;
            const fb = typeof data === 'string' ? data : typeof data === 'object' && data.feedback ? (typeof data.feedback === 'object' ? (data.feedback.correct || data.feedback.wrong) : data.feedback) : null;
            return (<div key={name}><div className="flex justify-between"><span className="text-gray-700 dark:text-zinc-300">{name}</span>{score !== null && <span className="text-gray-500">{score}/{maxS}</span>}</div>
              {score !== null && <div className="w-full h-1 rounded-full bg-gray-100 dark:bg-zinc-800 mt-1"><div className={`h-full rounded-full ${(score/maxS)>=0.7?'bg-emerald-500':(score/maxS)>=0.4?'bg-amber-500':'bg-rose-500'}`} style={{width:`${(score/maxS)*100}%`}}/></div>}
              {fb && <p className="text-xs text-gray-500 mt-0.5">{fb}</p>}</div>);
          })}
          {signal.feedback && <p className="text-gray-600 dark:text-zinc-400">{signal.feedback}</p>}
        </div>
      )}
    </div>
  );
}

export default function DemoPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [evals, setEvals] = useState<Map<number, QEval>>(new Map());
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evalRunning, setEvalRunning] = useState<string | null>(null);
  const [selectedQ, setSelectedQ] = useState<number | null>(null);
  const [humanScores, setHumanScores] = useState({ Understanding: 7, Application: 7, Clarity: 8 });
  const [humanFeedback, setHumanFeedback] = useState('');
  const [showHumanForm, setShowHumanForm] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/demo/questions`).then(r => r.json()).then(setQuestions).catch(() => {});
  }, []);

  // Submit all 10 answers at once
  const handleSubmitTest = useCallback(async () => {
    setSubmitting(true);
    const newEvals = new Map<number, QEval>();
    for (const q of questions) {
      try {
        const res = await fetch(`${BACKEND_URL}/demo/submit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question_id: q.id, user_answer: MOCK_ANSWERS[q.id] || 'No answer provided.' }),
        });
        const data = await res.json();
        newEvals.set(q.id, { evaluationId: data.evaluation_id, questionId: q.id, result: null });
      } catch (e) { console.error(e); }
    }
    setEvals(newEvals);
    setTestSubmitted(true);
    setSubmitting(false);
    setSelectedQ(questions[0]?.id || null);
  }, [questions]);

  // Run one eval type across all questions
  const runEvalAll = useCallback(async (type: 'ai' | 'semantic') => {
    setEvalRunning(type);
    const updated = new Map(evals);
    for (const [qId, qe] of evals) {
      try {
        await fetch(`${BACKEND_URL}/demo/evaluate/${type}/${qe.evaluationId}`, { method: 'POST' });
        const res = await fetch(`${BACKEND_URL}/demo/result/${qe.evaluationId}`);
        updated.set(qId, { ...qe, result: await res.json() });
      } catch (e) { console.error(e); }
    }
    setEvals(updated);
    setEvalRunning(null);
  }, [evals]);

  // Run human feedback for selected question
  const submitHuman = useCallback(async () => {
    if (!selectedQ) return;
    const qe = evals.get(selectedQ);
    if (!qe) return;
    setEvalRunning('human');
    try {
      const res = await fetch(`${BACKEND_URL}/demo/evaluate/human/${qe.evaluationId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: humanScores, feedback: humanFeedback || 'Good effort.' }),
      });
      const updated = new Map(evals);
      updated.set(selectedQ, { ...qe, result: await res.json() });
      setEvals(updated);
      setShowHumanForm(false);
    } catch (e) { console.error(e); }
    setEvalRunning(null);
  }, [selectedQ, evals, humanScores, humanFeedback]);

  const selectedEval = selectedQ ? evals.get(selectedQ) : null;
  const selectedResult = selectedEval?.result;
  const hasAi = selectedResult?.signals?.some(s => s.evaluator_type === 'ai');
  const hasSemantic = selectedResult?.signals?.some(s => s.evaluator_type === 'embedding');
  const hasHuman = selectedResult?.signals?.some(s => s.evaluator_type === 'human');
  const allHaveAi = [...evals.values()].every(e => e.result?.signals?.some(s => s.evaluator_type === 'ai'));
  const allHaveSemantic = [...evals.values()].every(e => e.result?.signals?.some(s => s.evaluator_type === 'embedding'));
  const scorePercent = selectedResult?.final_score != null ? Math.round((selectedResult.final_score / selectedResult.max_score) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#111]">
      <div className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A1A]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-light text-gray-900 dark:text-white">HyperVerge AI Assessment</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">10 questions with pre-filled answers — test the evaluation engine</p>
          </div>
          {!testSubmitted ? (
            <button onClick={handleSubmitTest} disabled={submitting || questions.length === 0}
              className="px-6 py-2.5 rounded-xl text-sm font-medium cursor-pointer bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting {questions.length} answers...</> : <><Send size={16} /> Submit Test</>}
            </button>
          ) : (
            <span className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 size={16} /> Test Submitted
            </span>
          )}
        </div>
      </div>

      {!testSubmitted ? (
        /* Pre-submit: show all questions with answers */
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-5">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-zinc-400">{i+1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{q.title}</p>
                  <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">{extractText(q.blocks)}</p>
                  <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-4 py-3">
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Student Answer</p>
                    <p className="text-sm text-gray-700 dark:text-zinc-300">{MOCK_ANSWERS[q.id]}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Post-submit: evaluation interface */
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* 3 Evaluation Buttons */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <button onClick={() => runEvalAll('ai')} disabled={evalRunning !== null || allHaveAi}
              className={`py-4 rounded-xl text-sm font-medium cursor-pointer flex flex-col items-center gap-2 transition-all ${
                allHaveAi ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-2 border-blue-200 dark:border-blue-800'
                : evalRunning === 'ai' ? 'bg-blue-600 text-white animate-pulse'
                : 'bg-white dark:bg-zinc-900 border-2 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white hover:border-blue-400 dark:hover:border-blue-600'
              }`}>
              {evalRunning === 'ai' ? <Loader2 size={20} className="animate-spin" /> : allHaveAi ? <CheckCircle2 size={20} /> : <Bot size={20} />}
              <span>{evalRunning === 'ai' ? 'Running AI Evaluation...' : allHaveAi ? 'AI Evaluation Complete' : 'Run AI Evaluation'}</span>
              <span className="text-xs opacity-60">Scores each answer on Understanding, Application, Clarity</span>
            </button>

            <button onClick={() => runEvalAll('semantic')} disabled={evalRunning !== null || allHaveSemantic}
              className={`py-4 rounded-xl text-sm font-medium cursor-pointer flex flex-col items-center gap-2 transition-all ${
                allHaveSemantic ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-2 border-emerald-200 dark:border-emerald-800'
                : evalRunning === 'semantic' ? 'bg-emerald-600 text-white animate-pulse'
                : 'bg-white dark:bg-zinc-900 border-2 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white hover:border-emerald-400 dark:hover:border-emerald-600'
              }`}>
              {evalRunning === 'semantic' ? <Loader2 size={20} className="animate-spin" /> : allHaveSemantic ? <CheckCircle2 size={20} /> : <Cpu size={20} />}
              <span>{evalRunning === 'semantic' ? 'Running Semantic Evaluation...' : allHaveSemantic ? 'Semantic Evaluation Complete' : 'Run Semantic Evaluation'}</span>
              <span className="text-xs opacity-60">Compares answers against reference using embeddings</span>
            </button>

            <button onClick={() => { setShowHumanForm(true); if (!selectedQ && questions.length) setSelectedQ(questions[0].id); }}
              disabled={evalRunning !== null}
              className={`py-4 rounded-xl text-sm font-medium cursor-pointer flex flex-col items-center gap-2 transition-all ${
                showHumanForm ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border-2 border-purple-200 dark:border-purple-800'
                : 'bg-white dark:bg-zinc-900 border-2 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white hover:border-purple-400 dark:hover:border-purple-600'
              }`}>
              <User size={20} />
              <span>Human Feedback</span>
              <span className="text-xs opacity-60">Manually score the selected question</span>
            </button>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left: Question List */}
            <div className="col-span-3">
              <div className="rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Questions</p>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-[60vh] overflow-y-auto">
                  {questions.map((qq, idx) => {
                    const qe = evals.get(qq.id);
                    const sigCount = qe?.result?.signals?.length || 0;
                    const isFinal = qe?.result?.status === 'final';
                    return (
                      <button key={qq.id} onClick={() => setSelectedQ(qq.id)}
                        className={`w-full text-left px-4 py-3 text-sm cursor-pointer transition-colors ${
                          selectedQ === qq.id ? 'bg-gray-100 dark:bg-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                        }`}>
                        <div className="flex items-center justify-between">
                          <span className={`${selectedQ === qq.id ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-zinc-400'}`}>
                            Q{idx+1}
                          </span>
                          <div className="flex items-center gap-1">
                            {sigCount > 0 && <span className="text-xs text-gray-400">{sigCount}/3</span>}
                            {isFinal && <CheckCircle2 size={12} className="text-emerald-500" />}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-zinc-500 truncate mt-0.5">{qq.title}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Middle: Question Detail */}
            <div className="col-span-5 space-y-4">
              {selectedQ && questions.find(q => q.id === selectedQ) && (() => {
                const q = questions.find(qq => qq.id === selectedQ)!;
                return (<>
                  <div className="rounded-xl p-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">{q.title}</p>
                    <p className="text-gray-900 dark:text-white leading-relaxed text-sm">{extractText(q.blocks)}</p>
                  </div>
                  <div className="rounded-xl p-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                    <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Student Answer</p>
                    <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">{MOCK_ANSWERS[q.id]}</p>
                  </div>
                  {/* Human feedback form inline */}
                  {showHumanForm && !hasHuman && (
                    <div className="rounded-xl p-5 bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 space-y-3">
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-400">Mentor Scores for Q{questions.findIndex(qq=>qq.id===selectedQ)+1}</p>
                      {Object.entries(humanScores).map(([c, s]) => (
                        <div key={c}>
                          <div className="flex justify-between mb-1"><label className="text-sm text-gray-600 dark:text-zinc-400">{c}</label><span className="text-sm font-medium">{s}/10</span></div>
                          <input type="range" min="1" max="10" step="1" value={s}
                            onChange={e => setHumanScores(p => ({...p, [c]: parseInt(e.target.value)}))}
                            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-zinc-700 accent-purple-500" />
                        </div>
                      ))}
                      <textarea value={humanFeedback} onChange={e => setHumanFeedback(e.target.value)}
                        placeholder="Overall feedback..." rows={2}
                        className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none" />
                      <button onClick={submitHuman} disabled={evalRunning === 'human'}
                        className="w-full py-2 rounded-lg text-sm font-medium cursor-pointer bg-purple-600 text-white hover:bg-purple-700 flex items-center justify-center gap-2">
                        {evalRunning === 'human' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        Submit & Finalize
                      </button>
                    </div>
                  )}
                </>);
              })()}
            </div>

            {/* Right: Results */}
            <div className="col-span-4 space-y-4">
              {selectedResult ? (
                <>
                  {selectedResult.final_score != null && (
                    <div className="rounded-xl p-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">{selectedResult.status === 'final' ? 'Final Score' : 'Provisional Score'}</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-3xl font-light text-gray-900 dark:text-white">{selectedResult.final_score.toFixed(1)}</span>
                            <span className="text-lg text-gray-400">/ {selectedResult.max_score}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Pass: {selectedResult.pass_score} |
                            <span className={`ml-1 font-medium ${selectedResult.status === 'final' ? 'text-emerald-600' : 'text-amber-600'}`}>{selectedResult.status}</span>
                          </p>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="w-14 h-14 relative">
                            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-200 dark:stroke-zinc-800" strokeWidth="2.5" />
                              <circle cx="18" cy="18" r="16" fill="none" strokeDasharray="100" strokeDashoffset={100-scorePercent}
                                className={scorePercent>=60?'stroke-emerald-500':scorePercent>=40?'stroke-amber-500':'stroke-rose-500'}
                                strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-900 dark:text-white">{scorePercent}%</div>
                          </div>
                          <span className={`mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            selectedResult.final_score >= selectedResult.pass_score
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                          }`}>{selectedResult.final_score >= selectedResult.pass_score ? 'Pass' : 'Fail'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Signals ({selectedResult.signals.length})</p>
                    {selectedResult.signals.map((s, i) => <SignalCard key={i} signal={s} />)}
                  </div>
                </>
              ) : (
                <div className="rounded-xl p-8 text-center bg-white dark:bg-zinc-900 border border-dashed border-gray-300 dark:border-zinc-700">
                  <p className="text-sm text-gray-400 dark:text-zinc-500">Run evaluations using the buttons above</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
