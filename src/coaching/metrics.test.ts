import assert from 'node:assert/strict';
import test from 'node:test';
import { CoachingProfileV1 } from './goals';
import { calculateWeeklyCoachingMetrics, completedReviewPeriod } from './metrics';
import { WorkoutSession } from '../types';

const profile = (): CoachingProfileV1 => ({
  schemaVersion: 1, id: 'profile', revision: 1, effectiveAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  goals: [{ id: 'goal', status: 'active', priority: 1, focus: { type: 'general_strength' }, motivation: null, targetDate: null }],
  constraints: { availableDaysPerWeek: 3, sessionMinutes: 60, equipment: [], considerations: null }, preferences: { preferredExerciseIds: [], avoidedExerciseIds: [] },
  consent: { coachingEnabled: true, shareWorkoutHistory: true, includeCheckIns: false, consentedAt: '2026-09-01T00:00:00.000Z', revokedAt: null },
  weeklyReview: { enabled: true, dayOfWeek: 0, timezone: 'America/New_York', notificationEnabled: false },
});

function workout(id: string, endedAt: string, weight: number | null, unit: 'lb' | 'kg', completed = true): WorkoutSession {
  return { id, ownerId: null, routineId: null, name: id, status: 'completed', startedAt: new Date(new Date(endedAt).getTime() - 3_600_000).toISOString(), endedAt, updatedAt: endedAt, exercises: [{ id: `${id}-exercise`, sessionId: id, exerciseId: 'bench', exerciseName: 'Bench Press', exerciseType: 'weighted', sortOrder: 0, sets: [{ id: `${id}-set`, workoutExerciseId: `${id}-exercise`, setNumber: 1, weight, reps: 5, unit, completedAt: completed ? endedAt : null, updatedAt: endedAt }] }] };
}

test('calculates completed local weeks across daylight-saving boundaries', () => {
  const beforeSpring = completedReviewPeriod(new Date('2026-03-09T01:00:00.000Z'), 0, 'America/New_York');
  assert.deepEqual(beforeSpring, { startDate: '2026-03-01', endDate: '2026-03-07', previousStartDate: '2026-02-22', previousEndDate: '2026-02-28', timezone: 'America/New_York' });
  const afterSpring = completedReviewPeriod(new Date('2026-03-15T13:00:00.000Z'), 0, 'America/New_York');
  assert.equal(afterSpring.startDate, '2026-03-08');
  assert.equal(afterSpring.endDate, '2026-03-14');
});

test('uses local dates, excludes incomplete sets, and normalizes mixed units', () => {
  const metrics = calculateWeeklyCoachingMetrics([
    workout('previous', '2026-09-05T18:00:00.000Z', 100, 'kg'),
    workout('current-lb', '2026-09-08T18:00:00.000Z', 220.462, 'lb'),
    workout('incomplete', '2026-09-10T18:00:00.000Z', 500, 'kg', false),
  ], profile(), new Date('2026-09-14T14:00:00.000Z'));
  assert.equal(metrics.period.startDate, '2026-09-06');
  assert.equal(metrics.completedSessions, 2);
  assert.equal(metrics.workingSets, 1);
  assert.equal(metrics.exercises[0].maxWeightKg, 100);
  assert.equal(metrics.coverage.comparableExerciseCount, 1);
  assert.equal(metrics.recommendedKind, 'weekly_review');
});

test('returns a continuity check-in for an empty or unusable week', () => {
  const metrics = calculateWeeklyCoachingMetrics([workout('old', '2026-08-01T18:00:00.000Z', 100, 'lb')], profile(), new Date('2026-09-14T14:00:00.000Z'));
  assert.equal(metrics.completedSessions, 0);
  assert.equal(metrics.latestWorkoutId, null);
  assert.equal(metrics.recommendedKind, 'continuity_check_in');
});
