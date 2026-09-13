import assert from 'node:assert/strict';
import test from 'node:test';
import { CoachingProfileV1, createDefaultCoachingProfile } from './goals';
import { weeklyScheduleDecision } from './scheduling';
import { CoachingGenerationRequestV1 } from './workflow';

function enabledProfile(): CoachingProfileV1 {
  const profile = createDefaultCoachingProfile('profile', '2026-03-01T12:00:00.000Z', 'America/New_York');
  return {
    ...profile,
    consent: { coachingEnabled: true, shareWorkoutHistory: true, includeCheckIns: false, consentedAt: profile.updatedAt, revokedAt: null },
    weeklyReview: { ...profile.weeklyReview, enabled: true, dayOfWeek: 0 },
  };
}

test('schedules the latest closed local week across the spring DST boundary', () => {
  assert.deepEqual(weeklyScheduleDecision(enabledProfile(), [], new Date('2026-03-08T13:00:00.000Z')), {
    shouldRequest: true,
    periodStart: '2026-03-01',
    periodEnd: '2026-03-07',
  });
});

test('does not schedule without explicit enablement and history consent', () => {
  const disabled = enabledProfile();
  disabled.weeklyReview.enabled = false;
  assert.equal(weeklyScheduleDecision(disabled, []).shouldRequest, false);
  const revoked = enabledProfile();
  revoked.consent.shareWorkoutHistory = false;
  assert.deepEqual(weeklyScheduleDecision(revoked, []), { shouldRequest: false, reason: 'consent_required', periodStart: null, periodEnd: null });
});

test('prevents a second automatic request for the same completed week', () => {
  const profile = enabledProfile();
  const request = {
    context: { metrics: { period: { startDate: '2026-03-01', endDate: '2026-03-07' } } },
  } as CoachingGenerationRequestV1;
  assert.deepEqual(weeklyScheduleDecision(profile, [request], new Date('2026-03-12T12:00:00.000Z')), {
    shouldRequest: false,
    reason: 'already_requested',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-07',
  });
});

test('catches up a missed review until the next preferred day closes another week', () => {
  const result = weeklyScheduleDecision(enabledProfile(), [], new Date('2026-03-14T16:00:00.000Z'));
  assert.deepEqual(result, { shouldRequest: true, periodStart: '2026-03-01', periodEnd: '2026-03-07' });
});
