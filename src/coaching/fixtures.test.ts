import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCoachReviewDraft } from './contracts';
import { COACH_REVIEW_FIXTURES_V1 } from './fixtures';

test('representative review fixtures cover every required training journey', () => {
  assert.deepEqual(COACH_REVIEW_FIXTURES_V1.map((fixture) => fixture.id), [
    'steady_progress',
    'apparent_plateau',
    'inconsistent_weeks',
    'return_after_break',
    'tighter_time_constraints',
  ]);
});

for (const fixture of COACH_REVIEW_FIXTURES_V1) {
  test(`${fixture.id} output passes contract v1 and cites only supplied workouts`, () => {
    const result = validateCoachReviewDraft(fixture.expectedReview, fixture.context);
    assert.equal(result.ok, true, result.ok ? undefined : result.errors.join('\n'));

    const suppliedIds = new Set(fixture.context.completedWorkouts.map((workout) => workout.id));
    const citedIds = [
      ...(fixture.expectedReview.journeyHighlight?.evidenceWorkoutIds ?? []),
      ...fixture.expectedReview.observations.flatMap((observation) => observation.evidenceWorkoutIds),
    ];
    for (const id of citedIds) assert.equal(suppliedIds.has(id), true, `${fixture.id} cites unknown workout ${id}`);
  });
}
