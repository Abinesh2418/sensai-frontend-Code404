import {
  Evaluation,
  EvaluationExplanationData,
  EvaluatorTrust,
  PendingReview,
  SubmitHumanFeedbackRequest,
  UpdateTrustWeightsRequest,
} from '@/types/evaluation';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// --- Evaluation Fetching ---

export async function getEvaluation(evaluationId: number): Promise<Evaluation> {
  const response = await fetch(`${BACKEND_URL}/evaluations/${evaluationId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch evaluation: ${response.status}`);
  }
  return response.json();
}

export async function getUserEvaluation(userId: number, taskId: number): Promise<Evaluation> {
  const response = await fetch(`${BACKEND_URL}/evaluations/user/${userId}/task/${taskId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user evaluation: ${response.status}`);
  }
  return response.json();
}

export async function getEvaluationExplanation(evaluationId: number): Promise<EvaluationExplanationData> {
  const response = await fetch(`${BACKEND_URL}/evaluations/${evaluationId}/explain`);
  if (!response.ok) {
    throw new Error(`Failed to fetch evaluation explanation: ${response.status}`);
  }
  return response.json();
}

// --- Mentor Reviews ---

export async function getPendingReviews(): Promise<PendingReview[]> {
  const response = await fetch(`${BACKEND_URL}/evaluations/review/pending`);
  if (!response.ok) {
    throw new Error(`Failed to fetch pending reviews: ${response.status}`);
  }
  return response.json();
}

export async function submitMentorFeedback(
  evaluationId: number,
  feedback: SubmitHumanFeedbackRequest
): Promise<Evaluation> {
  const response = await fetch(`${BACKEND_URL}/evaluations/${evaluationId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedback),
  });
  if (!response.ok) {
    throw new Error(`Failed to submit feedback: ${response.status}`);
  }
  return response.json();
}

// --- Trust Weights (Admin) ---

export async function getTrustWeights(): Promise<EvaluatorTrust[]> {
  const response = await fetch(`${BACKEND_URL}/evaluations/trust/weights`);
  if (!response.ok) {
    throw new Error(`Failed to fetch trust weights: ${response.status}`);
  }
  return response.json();
}

export async function updateTrustWeights(weights: UpdateTrustWeightsRequest): Promise<EvaluatorTrust[]> {
  const response = await fetch(`${BACKEND_URL}/evaluations/trust/weights`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(weights),
  });
  if (!response.ok) {
    throw new Error(`Failed to update trust weights: ${response.status}`);
  }
  return response.json();
}
