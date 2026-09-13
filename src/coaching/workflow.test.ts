import assert from 'node:assert/strict';
import test from 'node:test';
import { retryDelaySeconds, validateGenerationRequest } from './workflow';

test('uses bounded exponential retry delays', () => {
  assert.equal(retryDelaySeconds(1), 60);
  assert.equal(retryDelaySeconds(4), 480);
  assert.equal(retryDelaySeconds(99), 21_600);
});

test('rejects ready generation requests without a review', () => {
  const result = validateGenerationRequest({ requestVersion: 1, id: 'id', generationKey: 'key', context: { generationKey: 'key' }, status: 'ready', attempts: 1, requestedAt: '2026-09-13T00:00:00.000Z', updatedAt: '2026-09-13T00:00:00.000Z', nextAttemptAt: null, lastError: null, reviewId: null });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.includes('ready requests require reviewId.'));
});
