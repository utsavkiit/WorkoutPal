import assert from 'node:assert/strict';
import test from 'node:test';
import { canCompleteSet, moveItem, previousLabel } from './domain';
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
