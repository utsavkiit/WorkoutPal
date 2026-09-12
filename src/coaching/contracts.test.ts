import assert from 'node:assert/strict';
import test from 'node:test';
import { CoachReviewDraftV1, validateCoachReviewDraft } from './contracts';

const weeklyReview = (): CoachReviewDraftV1 => ({
  contractVersion: 1,
  generationKey: 'weekly:2026-09-07:2026-09-13:v1',
  kind: 'weekly_review',
  authoredBy: 'WorkoutPal coaching agent',
  generatedAt: '2026-09-14T12:00:00.000Z',
  periodStart: '2026-09-07',
  periodEnd: '2026-09-13',
  latestWorkoutId: 'workout-3',
  headline: 'Your pressing strength progressed while your schedule stayed sustainable.',
  journeyHighlight: {
    text: 'You trained in seven of the last eight weeks and reached your strongest recent bench set.',
    evidenceWorkoutIds: ['workout-3'],
  },
  observations: [{
    category: 'progress',
    text: 'Your top completed bench set increased from 165 lb for 6 reps to 170 lb for 6 reps.',
    evidenceWorkoutIds: ['workout-1', 'workout-3'],
  }],
  confidence: 'high',
  limitations: [],
  nextStep: {
    title: 'Repeat the current pressing progression',
    rationale: 'The current plan is producing measurable progress without exceeding your session-length constraint.',
  },
  contextUsed: [{ source: 'workoutpal', label: 'WorkoutPal completed workouts', status: 'used', startDate: '2026-07-20', endDate: '2026-09-13' }],
});

test('accepts a grounded weekly review matching the requested context', () => {
  const review = weeklyReview();
  const result = validateCoachReviewDraft(review, {
    generationKey: review.generationKey,
    periodStart: review.periodStart,
    periodEnd: review.periodEnd,
    latestWorkoutId: review.latestWorkoutId,
  });
  assert.equal(result.ok, true);
});

test('accepts a continuity check-in without fabricated workout evidence', () => {
  const review: CoachReviewDraftV1 = {
    ...weeklyReview(),
    kind: 'continuity_check_in',
    latestWorkoutId: null,
    headline: 'There is not enough new training for a full review, so make returning easy.',
    journeyHighlight: null,
    observations: [{ category: 'uncertainty', text: 'No completed workouts were available in this review period.', evidenceWorkoutIds: [] }],
    confidence: 'low',
    limitations: ['No completed workouts were logged during the review period.'],
    nextStep: { title: 'Choose one manageable session', rationale: 'A small re-entry step protects continuity without trying to recover missed volume.' },
  };
  assert.equal(validateCoachReviewDraft(review).ok, true);
});

test('rejects unsupported contract versions and ungrounded progress claims', () => {
  const review = weeklyReview() as unknown as Record<string, unknown>;
  review.contractVersion = 2;
  review.observations = [{ category: 'progress', text: 'Strength improved.', evidenceWorkoutIds: [] }];
  const result = validateCoachReviewDraft(review);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.includes('contractVersion must be 1.'));
    assert.ok(result.errors.some((error) => error.includes('must cite at least one workout')));
  }
});

test('rejects stale output that does not match the requested generation context', () => {
  const review = weeklyReview();
  const result = validateCoachReviewDraft(review, {
    generationKey: 'weekly:2026-09-14:2026-09-20:v1',
    periodStart: '2026-09-14',
    periodEnd: '2026-09-20',
    latestWorkoutId: 'workout-4',
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.includes('generationKey does not match the requested review.'));
    assert.ok(result.errors.includes('Review period does not match the requested review.'));
    assert.ok(result.errors.includes('latestWorkoutId does not match the coaching context.'));
  }
});

test('rejects invalid dates, oversized content, and duplicate evidence IDs', () => {
  const review = weeklyReview();
  review.periodEnd = '2026-02-30';
  review.headline = 'x'.repeat(181);
  review.journeyHighlight!.evidenceWorkoutIds = ['workout-3', 'workout-3'];
  const result = validateCoachReviewDraft(review);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.includes('periodEnd must be a valid YYYY-MM-DD date.'));
    assert.ok(result.errors.includes('headline must be 180 characters or fewer.'));
    assert.ok(result.errors.includes('journeyHighlight.evidenceWorkoutIds must not contain duplicate values.'));
  }
});

test('rejects ownership fields and output outside the review-only contract', () => {
  const review = weeklyReview() as unknown as Record<string, unknown>;
  review.ownerId = 'another-user';
  review.routineProposal = { name: 'Unvalidated routine' };
  const result = validateCoachReviewDraft(review);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.includes('review.ownerId is not supported by contract v1.'));
    assert.ok(result.errors.includes('review.routineProposal is not supported by contract v1.'));
  }
});

test('requires WorkoutPal to be present as the baseline context source', () => {
  const review = weeklyReview();
  review.contextUsed = [{ source: 'external', label: 'Optional recovery context', status: 'used', startDate: '2026-09-07', endDate: '2026-09-13' }];
  const result = validateCoachReviewDraft(review);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.includes('contextUsed must include WorkoutPal as the baseline source.'));
});
