import { CoachingContextV1 } from './context';

export const COACHING_REQUEST_VERSION = 1 as const;
export type CoachingRequestStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface CoachingGenerationRequestV1 {
  requestVersion: typeof COACHING_REQUEST_VERSION;
  id: string;
  generationKey: string;
  context: CoachingContextV1;
  status: CoachingRequestStatus;
  attempts: number;
  requestedAt: string;
  updatedAt: string;
  nextAttemptAt: string | null;
  lastError: string | null;
  reviewId: string | null;
}

export function validateGenerationRequest(value: unknown): { ok: true; value: CoachingGenerationRequestV1 } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, errors: ['Generation request must be an object.'] };
  const input = value as Partial<CoachingGenerationRequestV1>;
  if (input.requestVersion !== COACHING_REQUEST_VERSION) errors.push(`requestVersion must be ${COACHING_REQUEST_VERSION}.`);
  if (typeof input.id !== 'string' || !input.id.trim()) errors.push('id is required.');
  if (typeof input.generationKey !== 'string' || !input.generationKey.trim()) errors.push('generationKey is required.');
  if (!input.context || input.context.generationKey !== input.generationKey) errors.push('context must match generationKey.');
  if (!['pending', 'processing', 'ready', 'failed'].includes(input.status ?? '')) errors.push('status is invalid.');
  if (!Number.isInteger(input.attempts) || (input.attempts ?? -1) < 0) errors.push('attempts must be a non-negative integer.');
  for (const key of ['requestedAt', 'updatedAt'] as const) if (typeof input[key] !== 'string' || Number.isNaN(Date.parse(input[key]!))) errors.push(`${key} must be an ISO timestamp.`);
  if (input.nextAttemptAt !== null && (typeof input.nextAttemptAt !== 'string' || Number.isNaN(Date.parse(input.nextAttemptAt)))) errors.push('nextAttemptAt must be an ISO timestamp or null.');
  if (input.lastError !== null && (typeof input.lastError !== 'string' || !input.lastError.trim() || input.lastError.length > 500)) errors.push('lastError must be a non-empty string up to 500 characters or null.');
  if (input.reviewId !== null && (typeof input.reviewId !== 'string' || !input.reviewId.trim())) errors.push('reviewId must be a non-empty string or null.');
  if (input.status === 'ready' && !input.reviewId) errors.push('ready requests require reviewId.');
  return errors.length ? { ok: false, errors } : { ok: true, value: input as CoachingGenerationRequestV1 };
}

export function retryDelaySeconds(attempt: number) {
  return Math.min(6 * 60 * 60, 60 * 2 ** Math.max(0, attempt - 1));
}
