import assert from 'node:assert/strict';
import test from 'node:test';
import { SEEDED_EXERCISES } from '../data/exercises';
import { CoachingContextV1 } from './context';
import { CoachRoutineProposalDraftV1, createStoredCoachRoutineProposal, sourceRoutineStillMatches, validateCoachRoutineProposalDraft, validateStoredCoachRoutineProposal } from './proposals';

const [bench, squat, row] = SEEDED_EXERCISES;
const source = { id: '10000000-0000-4000-8000-000000000001', name: 'Full Body', version: '2026-09-14T12:00:00.000Z', exercises: [
  { exerciseId: bench.id, name: bench.name, sortOrder: 0, setCount: 3 },
  { exerciseId: squat.id, name: squat.name, sortOrder: 1, setCount: 3 },
] };
const draft = (): CoachRoutineProposalDraftV1 => ({ proposalVersion: 1, name: 'Full Body Next', summary: 'Add a pull while retaining the main lifts.', exercises: [
  { exerciseId: bench.id, setCount: 3, rationale: 'Keep the familiar press.' },
  { exerciseId: squat.id, setCount: 3, rationale: 'Keep the familiar squat.' },
  { exerciseId: row.id, setCount: 2, rationale: 'Balance the pressing with a pull.' },
], removed: [], limitations: [] });
const context = { generationKey: 'generation', currentRoutine: source, exerciseCatalog: SEEDED_EXERCISES.map((item) => ({ id: item.id, name: item.name, muscleGroup: item.muscleGroup, equipment: item.equipment, type: item.type })), evidenceWorkouts: [] } as unknown as CoachingContextV1;

test('accepts a bounded recommendation and binds immutable source data', () => {
  const record = createStoredCoachRoutineProposal(context, '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', draft());
  assert.equal(record.sourceRoutine?.version, source.version);
  assert.equal(validateStoredCoachRoutineProposal(record).ok, true);
});

test('rejects unknown exercises, missing explanations, no-op changes, and large workload jumps', () => {
  const unknown = draft(); unknown.exercises[2].exerciseId = '90000000-0000-4000-8000-000000000001';
  assert.throws(() => createStoredCoachRoutineProposal(context, '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', unknown), /outside the supplied coaching context/);
  const removed = draft(); removed.exercises = removed.exercises.filter((item) => item.exerciseId !== squat.id);
  assert.equal(validateCoachRoutineProposalDraft(removed, source).ok, false);
  removed.removed = [{ exerciseId: squat.id, rationale: 'Reduce session time.' }];
  assert.equal(validateCoachRoutineProposalDraft(removed, source).ok, true);
  const noop = draft(); noop.name = source.name; noop.exercises = noop.exercises.slice(0, 2);
  assert.equal(validateCoachRoutineProposalDraft(noop, source).ok, false);
  const jump = draft(); jump.exercises[2].setCount = 6; jump.exercises[0].setCount = 6; jump.exercises[1].setCount = 6;
  assert.equal(validateCoachRoutineProposalDraft(jump, source).ok, false);
});

test('a changed source routine cannot be silently adopted', () => {
  const current = { id: source.id, name: source.name, updatedAt: source.version, archived: false, exercises: source.exercises.map(({ exerciseId, sortOrder, setCount }) => ({ exerciseId, sortOrder, setCount })) };
  assert.equal(sourceRoutineStillMatches(source, current), true);
  assert.equal(sourceRoutineStillMatches(source, { ...current, updatedAt: '2026-09-14T12:00:00+00:00' }), true);
  assert.equal(sourceRoutineStillMatches(source, { ...current, updatedAt: '2026-09-15T12:00:00.000Z' }), false);
  assert.equal(sourceRoutineStillMatches(source, { ...current, exercises: current.exercises.slice(0, 1) }), false);
  assert.equal(sourceRoutineStillMatches(null, null), true);
  assert.equal(sourceRoutineStillMatches(null, current), false);
});
