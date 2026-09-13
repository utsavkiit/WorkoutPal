import { CoachReviewDraftV1, validateCoachReviewDraft } from './contracts';
import { CoachingContextV1 } from './context';

export const STORED_COACH_REVIEW_VERSION = 1 as const;

export interface StoredCoachReviewV1 {
  storageVersion: typeof STORED_COACH_REVIEW_VERSION;
  id: string;
  revision: 1;
  profileId: string;
  profileRevision: number;
  contextVersion: number;
  generationKey: string;
  publishedAt: string;
  review: CoachReviewDraftV1;
}

export type StoredReviewValidation = { ok: true; value: StoredCoachReviewV1 } | { ok: false; errors: string[] };

function timestamp(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

export function validateStoredCoachReview(value: unknown): StoredReviewValidation {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, errors: ['Stored review must be an object.'] };
  const input = value as Partial<StoredCoachReviewV1>;
  if (input.storageVersion !== STORED_COACH_REVIEW_VERSION) errors.push(`storageVersion must be ${STORED_COACH_REVIEW_VERSION}.`);
  if (typeof input.id !== 'string' || !input.id.trim()) errors.push('id is required.');
  if (input.revision !== 1) errors.push('revision must be 1 for immutable review records.');
  if (typeof input.profileId !== 'string' || !input.profileId.trim()) errors.push('profileId is required.');
  if (!Number.isInteger(input.profileRevision) || (input.profileRevision ?? 0) < 1) errors.push('profileRevision must be positive.');
  if (!Number.isInteger(input.contextVersion) || (input.contextVersion ?? 0) < 1) errors.push('contextVersion must be positive.');
  if (typeof input.generationKey !== 'string' || !input.generationKey.trim()) errors.push('generationKey is required.');
  if (!timestamp(input.publishedAt)) errors.push('publishedAt must be an ISO timestamp.');
  const review = validateCoachReviewDraft(input.review, input.review ? {
    generationKey: input.generationKey ?? '',
    periodStart: input.review.periodStart,
    periodEnd: input.review.periodEnd,
    latestWorkoutId: input.review.latestWorkoutId,
  } : undefined);
  if (!review.ok) errors.push(...review.errors.map((error) => `review.${error}`));
  return errors.length ? { ok: false, errors } : { ok: true, value: input as StoredCoachReviewV1 };
}

export function createStoredCoachReview(context: CoachingContextV1, draft: CoachReviewDraftV1, id: string, publishedAt = new Date().toISOString()): StoredCoachReviewV1 {
  const validation = validateCoachReviewDraft(draft, {
    generationKey: context.generationKey,
    periodStart: context.metrics.period.startDate,
    periodEnd: context.metrics.period.endDate,
    latestWorkoutId: context.metrics.latestWorkoutId,
  });
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  const evidenceIds = new Set(context.evidenceWorkouts.map((workout) => workout.id));
  const cited = [
    ...(draft.journeyHighlight?.evidenceWorkoutIds ?? []),
    ...draft.observations.flatMap((observation) => observation.evidenceWorkoutIds),
  ];
  const missing = cited.filter((workoutId) => !evidenceIds.has(workoutId));
  if (missing.length) throw new Error(`Review cites workouts outside its context: ${[...new Set(missing)].join(', ')}`);
  return {
    storageVersion: STORED_COACH_REVIEW_VERSION,
    id,
    revision: 1,
    profileId: context.profile.id,
    profileRevision: context.profile.revision,
    contextVersion: context.contextVersion,
    generationKey: context.generationKey,
    publishedAt,
    review: validation.value,
  };
}

export function reviewDataState(review: StoredCoachReviewV1, currentContext: CoachingContextV1 | null) {
  if (!currentContext) return 'unavailable' as const;
  return review.generationKey === currentContext.generationKey ? 'current' as const : 'superseded' as const;
}
