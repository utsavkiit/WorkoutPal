import assert from 'node:assert/strict';
import test from 'node:test';
import { isJwtIssuedAtFuture, retryJwtIssuedAtFuture } from './syncRetry';

test('recognizes only the transient PostgREST future-JWT error', () => {
  assert.equal(isJwtIssuedAtFuture({ code: 'PGRST303', message: 'JWT issued at future' }), true);
  assert.equal(isJwtIssuedAtFuture({ code: 'PGRST303', message: 'JWT expired' }), false);
  assert.equal(isJwtIssuedAtFuture({ code: '42501', message: 'permission denied' }), false);
  assert.equal(isJwtIssuedAtFuture(null), false);
});

test('retries the transient error with bounded delays and returns the recovered result', async () => {
  const results = [
    { error: { code: 'PGRST303', message: 'JWT issued at future' } },
    { error: { code: 'PGRST303', message: 'JWT issued at future' } },
    { error: null },
  ];
  const waits: number[] = [];
  let attempts = 0;

  const result = await retryJwtIssuedAtFuture(
    async () => results[attempts++],
    (value) => value.error,
    { delaysMs: [10, 20, 30], sleep: async (delayMs) => { waits.push(delayMs); } },
  );

  assert.equal(result.error, null);
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [10, 20]);
});

test('does not retry unrelated failures', async () => {
  let attempts = 0;
  const result = await retryJwtIssuedAtFuture(
    async () => { attempts += 1; return { error: { code: '42501', message: 'permission denied' } }; },
    (value) => value.error,
    { sleep: async () => { throw new Error('unexpected retry'); } },
  );

  assert.equal(result.error.code, '42501');
  assert.equal(attempts, 1);
});

test('stops after the configured retry budget', async () => {
  let attempts = 0;
  const result = await retryJwtIssuedAtFuture(
    async () => { attempts += 1; return { error: { code: 'PGRST303', message: 'JWT issued at future' } }; },
    (value) => value.error,
    { delaysMs: [10, 20], sleep: async () => {} },
  );

  assert.equal(result.error.code, 'PGRST303');
  assert.equal(attempts, 3);
});
