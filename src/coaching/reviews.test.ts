import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCoachingContext } from './context';
import { COACH_REVIEW_FIXTURES_V1 } from './fixtures';
import { CoachingProfileV1 } from './goals';
import { calculateWeeklyCoachingMetrics } from './metrics';
import { classifyRemoteCoachReviews, createStoredCoachReview, reviewDataState, validateStoredCoachReview } from './reviews';
import { WorkoutSession } from '../types';

const fixture = COACH_REVIEW_FIXTURES_V1[0];
const profile: CoachingProfileV1 = { schemaVersion: 1, id: 'profile', revision: 1, effectiveAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', goals: [{ id: 'goal', status: 'active', priority: 1, focus: { type: 'general_strength' }, motivation: null, targetDate: null }], constraints: { availableDaysPerWeek: 3, sessionMinutes: 60, equipment: [], considerations: null }, preferences: { preferredExerciseIds: [], avoidedExerciseIds: [] }, consent: { coachingEnabled: true, shareWorkoutHistory: true, includeCheckIns: false, consentedAt: '2026-09-01T00:00:00.000Z', revokedAt: null }, weeklyReview: { enabled: true, dayOfWeek: 1, timezone: 'UTC', notificationEnabled: false } };
const workouts: WorkoutSession[] = fixture.context.completedWorkouts.map((item) => ({ id: item.id, ownerId: null, routineId: null, name: item.summary, status: 'completed', startedAt: `${item.completedDate}T11:00:00.000Z`, endedAt: `${item.completedDate}T12:00:00.000Z`, updatedAt: `${item.completedDate}T12:00:00.000Z`, exercises: [{ id: `${item.id}-exercise`, sessionId: item.id, exerciseId: 'bench', exerciseName: 'Bench Press', exerciseType: 'weighted', sortOrder: 0, sets: [{ id: `${item.id}-set`, workoutExerciseId: `${item.id}-exercise`, setNumber: 1, weight: 100, reps: 5, unit: 'lb', completedAt: `${item.completedDate}T12:00:00.000Z`, updatedAt: `${item.completedDate}T12:00:00.000Z` }] }] }));

function context() {
  const metrics = calculateWeeklyCoachingMetrics(workouts, profile, new Date('2026-09-14T12:00:00.000Z'));
  return buildCoachingContext({ profile, metrics, workouts, currentRoutine: null, generatedAt: '2026-09-14T12:00:00.000Z' });
}

test('publishes a contract-valid immutable review bound to its context', () => {
  const current = context();
  const draft = { ...fixture.expectedReview, generationKey: current.generationKey, periodStart: current.metrics.period.startDate, periodEnd: current.metrics.period.endDate, latestWorkoutId: current.metrics.latestWorkoutId };
  const stored = createStoredCoachReview(current, draft, 'review-1', '2026-09-14T13:00:00.000Z');
  assert.equal(validateStoredCoachReview(stored).ok, true);
  assert.equal(stored.profileRevision, 1);
  assert.equal(reviewDataState(stored, current), 'current');
});

test('rejects evidence outside the bounded context', () => {
  const current = context();
  const draft = { ...fixture.expectedReview, generationKey: current.generationKey, periodStart: current.metrics.period.startDate, periodEnd: current.metrics.period.endDate, latestWorkoutId: current.metrics.latestWorkoutId, observations: [{ ...fixture.expectedReview.observations[0], evidenceWorkoutIds: ['invented'] }] };
  assert.throws(() => createStoredCoachReview(current, draft, 'review-1'), /outside its context/);
});

test('marks a review superseded when history changes its generation key', () => {
  const first = context();
  const draft = { ...fixture.expectedReview, generationKey: first.generationKey, periodStart: first.metrics.period.startDate, periodEnd: first.metrics.period.endDate, latestWorkoutId: first.metrics.latestWorkoutId };
  const stored = createStoredCoachReview(first, draft, 'review-1');
  const corrected = workouts.map((workout, index) => index ? workout : { ...workout, updatedAt: '2026-09-14T14:00:00.000Z' });
  const next = buildCoachingContext({ profile, metrics: calculateWeeklyCoachingMetrics(corrected, profile, new Date('2026-09-14T12:00:00.000Z')), workouts: corrected, currentRoutine: null });
  assert.equal(reviewDataState(stored, next), 'superseded');
});

test('quarantines malformed direct-agent reviews without rejecting valid rows', () => {
  const current = context();
  const draft = { ...fixture.expectedReview, generationKey: current.generationKey, periodStart: current.metrics.period.startDate, periodEnd: current.metrics.period.endDate, latestWorkoutId: current.metrics.latestWorkoutId };
  const valid = createStoredCoachReview(current, draft, 'valid-review');
  const malformed = {
    storageVersion: 1,
    id: 'bad-review',
    revision: 1,
    profileId: valid.profileId,
    profileRevision: valid.profileRevision,
    contextVersion: valid.contextVersion,
    generationKey: valid.generationKey,
    review: { contractVersion: 1, title: 'Wrong direct-write shape', observations: ['not structured'] },
  };
  const result = classifyRemoteCoachReviews([{ id: valid.id, payload: valid }, { id: 'bad-review', payload: malformed }]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].review.id, valid.id);
  assert.ok(result.rejected.get('bad-review')?.some((error) => error.includes('publishedAt')));
});
