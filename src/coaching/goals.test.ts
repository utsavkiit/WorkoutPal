import assert from 'node:assert/strict';
import test from 'node:test';
import { CoachingCheckInV1, CoachingProfileV1, createDefaultCoachingProfile, validateCoachingCheckIn, validateCoachingProfile } from './goals';

const profile = (): CoachingProfileV1 => ({
  schemaVersion: 1,
  id: 'profile-1',
  revision: 1,
  effectiveAt: '2026-09-12T12:00:00.000Z',
  updatedAt: '2026-09-12T12:00:00.000Z',
  goals: [{
    id: 'goal-1',
    status: 'active',
    priority: 1,
    focus: { type: 'specific_lift_strength', exerciseId: 'bench-press', target: { weight: 225, reps: 5, unit: 'lb' } },
    motivation: 'Build strength steadily without making training consume the week.',
    targetDate: '2027-03-01',
  }],
  constraints: { availableDaysPerWeek: 3, sessionMinutes: 60, equipment: ['barbell', 'rack'], considerations: null },
  preferences: { preferredExerciseIds: ['bench-press'], avoidedExerciseIds: [] },
  consent: { coachingEnabled: true, shareWorkoutHistory: true, includeCheckIns: true, consentedAt: '2026-09-12T12:00:00.000Z', revokedAt: null },
  weeklyReview: { enabled: true, dayOfWeek: 0, timezone: 'America/New_York', notificationEnabled: true },
});

test('accepts a versioned profile with a primary strength goal and explicit consent', () => {
  assert.equal(validateCoachingProfile(profile()).ok, true);
});

test('accepts each initial goal focus', () => {
  const focuses: CoachingProfileV1['goals'][number]['focus'][] = [
    { type: 'general_strength' },
    { type: 'specific_lift_strength', exerciseId: 'squat', target: { weight: 315, reps: 3, unit: 'lb' } },
    { type: 'hypertrophy', muscleGroups: ['Chest', 'Back'] },
    { type: 'consistency', sessionsPerWeek: 3 },
    { type: 'maintenance', exerciseIds: ['squat', 'bench-press'] },
  ];
  for (const focus of focuses) {
    const value = profile();
    value.goals[0].focus = focus;
    assert.equal(validateCoachingProfile(value).ok, true, focus.type);
  }
});

test('requires exactly one active primary goal and unique active priorities', () => {
  const value = profile();
  value.goals.push({ ...value.goals[0], id: 'goal-2', priority: 1, focus: { type: 'consistency', sessionsPerWeek: 3 } });
  const result = validateCoachingProfile(value);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.includes('Active goal priorities must be unique.'));
    assert.ok(result.errors.includes('An active goal set must contain exactly one priority-1 goal.'));
  }
});

test('rejects conflicting exercise preferences and invalid goal targets', () => {
  const value = profile();
  value.preferences.avoidedExerciseIds = ['bench-press'];
  value.goals[0].focus = { type: 'specific_lift_strength', exerciseId: 'bench-press', target: { weight: 0, reps: 0, unit: 'lb' } };
  const result = validateCoachingProfile(value);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.includes('An exercise cannot be both preferred and avoided.'));
    assert.ok(result.errors.some((error) => error.includes('target.weight must be positive')));
    assert.ok(result.errors.some((error) => error.includes('target.reps must be an integer')));
  }
});

test('requires explicit history consent for enabled weekly coaching', () => {
  const value = profile();
  value.consent.shareWorkoutHistory = false;
  value.consent.consentedAt = null;
  const result = validateCoachingProfile(value);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.includes('Enabled coaching requires workout-history consent.'));
    assert.ok(result.errors.includes('Enabled coaching requires consentedAt.'));
  }
});

test('rejects invalid weekly scheduling and scheduling without coaching', () => {
  const value = profile();
  value.consent.coachingEnabled = false;
  value.weeklyReview.timezone = 'Not/A_Timezone';
  const result = validateCoachingProfile(value);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.includes('weeklyReview.timezone must be a valid IANA timezone.'));
    assert.ok(result.errors.includes('Weekly reviews require coaching consent.'));
  }
});

test('allows a directional lift goal and preserves inactive goal history', () => {
  const directional = profile();
  directional.goals[0].focus = { type: 'specific_lift_strength', exerciseId: 'bench-press', target: null };
  assert.equal(validateCoachingProfile(directional).ok, true);

  const inactive = profile();
  inactive.goals[0].status = 'achieved';
  inactive.consent.coachingEnabled = false;
  inactive.weeklyReview.enabled = false;
  assert.equal(validateCoachingProfile(inactive).ok, true);
});

test('creates a safe local-only default profile', () => {
  const value = createDefaultCoachingProfile('profile-local', '2026-09-13T12:00:00.000Z', 'America/New_York');
  assert.equal(validateCoachingProfile(value).ok, true);
  assert.equal(value.consent.coachingEnabled, false);
  assert.equal(value.consent.shareWorkoutHistory, false);
  assert.equal(value.weeklyReview.enabled, false);
});

test('validates bounded check-ins tied to an immutable profile revision', () => {
  const checkIn: CoachingCheckInV1 = {
    schemaVersion: 1,
    id: 'check-in-1',
    profileId: 'profile-1',
    profileRevision: 2,
    createdAt: '2026-09-13T12:00:00.000Z',
    updatedAt: '2026-09-13T12:00:00.000Z',
    energy: 4,
    recovery: 3,
    note: 'Short week, but sleep improved.',
  };
  assert.equal(validateCoachingCheckIn(checkIn).ok, true);
  assert.equal(validateCoachingCheckIn({ ...checkIn, energy: 6, note: 'x'.repeat(501) }).ok, false);
});
