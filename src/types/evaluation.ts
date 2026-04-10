// Evaluation system types matching backend v0.1

export type EvaluationStatus = 'pending' | 'in_progress' | 'provisional' | 'final';

export type EvaluatorType = 'ai' | 'embedding' | 'human';

export interface EvaluationSignal {
  id: number;
  evaluation_id: number;
  evaluator_type: EvaluatorType;
  evaluator_id: string | null;
  score: number | null;
  max_score: number | null;
  normalized_score: number | null;
  confidence: number | null;
  weight: number | null;
  criteria_scores: Record<string, any> | null;
  feedback: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationExplanationData {
  formula: string;
  signals: {
    evaluator_type: EvaluatorType;
    normalized_score: number | null;
    weight: number | null;
    confidence: number | null;
    contribution: number | null;
  }[];
  weighted_sum: number;
  weight_confidence_sum: number;
  final_score: number;
  max_score: number;
  human_feedback?: string | null;
}

export interface Evaluation {
  id: number;
  user_id: number;
  task_id: number;
  question_id: number | null;
  status: EvaluationStatus;
  final_score: number | null;
  max_score: number;
  pass_score: number;
  explanation: EvaluationExplanationData | null;
  signals: EvaluationSignal[];
  created_at: string;
  updated_at: string;
}

export interface TriggerEvaluationRequest {
  user_id: number;
  task_id: number;
  question_id?: number;
}

export interface SubmitHumanFeedbackRequest {
  reviewer_user_id?: number;
  feedback?: string;
  overall_feedback?: string;
  criteria_feedback?: Record<string, string>;
}

export interface UpdateTrustWeightsRequest {
  ai: number;
  embedding: number;
}

export interface EvaluatorTrust {
  id: number;
  org_id: number;
  evaluator_type: 'ai' | 'embedding';
  trust_weight: number;
  total_agreements: number;
  total_evaluations: number;
  created_at: string;
  updated_at: string;
}

export interface PendingReview {
  evaluation_id: number;
  user_id: number;
  user_name: string;
  task_id: number;
  task_title: string;
  question_id: number | null;
  question_title: string | null;
  status: EvaluationStatus;
  ai_score: number | null;
  max_score: number;
  created_at: string;
}
