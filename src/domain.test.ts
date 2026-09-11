import assert from 'node:assert/strict';
import test from 'node:test';
import { canCompleteSet, moveItem, previousLabel, shiftWorkoutDates, validateHistoryDate, validateHistoryName } from './domain';
import { secondsToClock, validReps, validWeight, workoutDuration } from './utils';

test('weighted sets require both weight and positive reps', () => {
  assert.equal(canCompleteSet('weighted', null, 8), false);
  assert.equal(canCompleteSet('weighted', 0, 8), true);
  assert.equal(canCompleteSet('weighted', 135.5, 0), false);
});

test('bodyweight sets only require positive reps', () => {
  assert.equal(canCompleteSet('bodyweight', null, 12), true);
  assert.equal(canCompleteSet('bodyweight', null, null), false);
});

test('moveItem reorders within bounds without mutating input', () => {
  const original = ['a','b','c'];
  assert.deepEqual(moveItem(original, 1, -1), ['b','a','c']);
  assert.deepEqual(moveItem(original, 0, -1), original);
  assert.deepEqual(original, ['a','b','c']);
});

test('formatters and input validation handle workout values', () => {
  assert.equal(secondsToClock(90), '1:30');
  assert.equal(previousLabel({weight: 135, reps: 8, unit: 'lb'}), '135 lb × 8');
  assert.equal(previousLabel({weight: null, reps: 10, unit: 'lb'}), 'BW × 10');
  assert.equal(validWeight('12.25'), true);
  assert.equal(validWeight('12.345'), false);
  assert.equal(validReps('999'), true);
  assert.equal(validReps('1000'), false);
  assert.equal(workoutDuration('2026-01-01T10:00:00Z','2026-01-01T11:15:00Z'), '1h 15m');
});

test('validateHistoryName trims, requires non-empty, and caps length', () => {
  assert.deepEqual(validateHistoryName('  Leg day  '), { ok: true, name: 'Leg day' });
  assert.equal(validateHistoryName('   ').ok, false);
  assert.equal(validateHistoryName('x'.repeat(61)).ok, false);
});

test('validateHistoryDate preserves time-of-day and rejects rollovers and future dates', () => {
  const reference = '2026-01-05T18:30:00.000Z';
  const now = '2026-01-10T00:00:00.000Z';
  const valid = validateHistoryDate(reference, 2026, 1, 3, now);
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.date.getUTCHours(), new Date(reference).getUTCHours());
    assert.equal(valid.date.getFullYear(), 2026);
  }
  assert.equal(validateHistoryDate(reference, 2026, 2, 30, now).ok, false);
  assert.equal(validateHistoryDate(reference, 2026, 1, 20, now).ok, false);
  assert.equal(validateHistoryDate(reference, 2026.5, 1, 3, now).ok, false);
});

test('shiftWorkoutDates preserves duration when the date is corrected', () => {
  const corrected = new Date('2026-01-03T18:30:00.000Z');
  const result = shiftWorkoutDates('2026-01-05T17:00:00.000Z', '2026-01-05T18:30:00.000Z', corrected);
  assert.equal(result.endedAt, corrected.toISOString());
  assert.equal(new Date(result.endedAt).getTime() - new Date(result.startedAt).getTime(), 90 * 60 * 1000);
});
