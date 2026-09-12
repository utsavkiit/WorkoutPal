import { CoachReviewDraftV1, ExpectedCoachReviewContext } from './contracts';

export interface CoachFixtureWorkout {
  id: string;
  completedDate: string;
  summary: string;
}

export interface CoachReviewFixtureV1 {
  id: 'steady_progress' | 'apparent_plateau' | 'inconsistent_weeks' | 'return_after_break' | 'tighter_time_constraints';
  purpose: string;
  context: ExpectedCoachReviewContext & {
    goal: string;
    constraints: string[];
    completedWorkouts: CoachFixtureWorkout[];
  };
  expectedReview: CoachReviewDraftV1;
  evaluationNotes: {
    shouldRecognize: string;
    shouldAvoid: string;
  };
}

const source = (startDate: string, endDate: string) => ({
  source: 'workoutpal' as const,
  label: 'WorkoutPal completed workouts and current goals',
  status: 'used' as const,
  startDate,
  endDate,
});

export const COACH_REVIEW_FIXTURES_V1: CoachReviewFixtureV1[] = [
  {
    id: 'steady_progress',
    purpose: 'Recognize measurable progress and preserve a plan that is already working.',
    context: {
      generationKey: 'fixture:steady-progress:2026-09-07:2026-09-13:v1',
      periodStart: '2026-09-07',
      periodEnd: '2026-09-13',
      latestWorkoutId: 'steady-3',
      goal: 'Increase general strength while training three times per week in sessions under 60 minutes.',
      constraints: ['Three sessions per week', 'Sessions no longer than 60 minutes'],
      completedWorkouts: [
        { id: 'steady-0', completedDate: '2026-08-31', summary: 'Bench press top completed set: 165 lb × 6.' },
        { id: 'steady-1', completedDate: '2026-09-08', summary: 'Full-body session completed in 54 minutes.' },
        { id: 'steady-2', completedDate: '2026-09-10', summary: 'Full-body session completed in 56 minutes.' },
        { id: 'steady-3', completedDate: '2026-09-12', summary: 'Full-body session completed in 55 minutes; bench press top completed set: 170 lb × 6.' },
      ],
    },
    expectedReview: {
      contractVersion: 1,
      generationKey: 'fixture:steady-progress:2026-09-07:2026-09-13:v1',
      kind: 'weekly_review',
      authoredBy: 'WorkoutPal fixture coach',
      generatedAt: '2026-09-14T12:00:00.000Z',
      periodStart: '2026-09-07',
      periodEnd: '2026-09-13',
      latestWorkoutId: 'steady-3',
      headline: 'Your strength and training consistency both moved forward this week.',
      journeyHighlight: { text: 'You completed all three intended sessions within your 60-minute limit.', evidenceWorkoutIds: ['steady-1', 'steady-2', 'steady-3'] },
      observations: [
        { category: 'progress', text: 'Your completed bench top set increased from 165 lb × 6 to 170 lb × 6.', evidenceWorkoutIds: ['steady-0', 'steady-3'] },
        { category: 'consistency', text: 'All three sessions stayed between 54 and 56 minutes.', evidenceWorkoutIds: ['steady-1', 'steady-2', 'steady-3'] },
      ],
      confidence: 'high',
      limitations: [],
      nextStep: { title: 'Continue the current progression', rationale: 'The current structure is improving performance while fitting the schedule you chose.' },
      contextUsed: [source('2026-08-31', '2026-09-12')],
    },
    evaluationNotes: {
      shouldRecognize: 'Both the performance increase and sustainable session duration.',
      shouldAvoid: 'Changing exercises or adding volume merely to make a recommendation.',
    },
  },
  {
    id: 'apparent_plateau',
    purpose: 'Avoid declaring a plateau from ordinary variation across a small sample.',
    context: {
      generationKey: 'fixture:apparent-plateau:2026-09-07:2026-09-13:v1',
      periodStart: '2026-09-07',
      periodEnd: '2026-09-13',
      latestWorkoutId: 'plateau-4',
      goal: 'Increase bench press strength.',
      constraints: ['Bench press appears once per week'],
      completedWorkouts: [
        { id: 'plateau-1', completedDate: '2026-08-22', summary: 'Bench press top completed set: 185 lb × 5.' },
        { id: 'plateau-2', completedDate: '2026-08-29', summary: 'Bench press top completed set: 185 lb × 6.' },
        { id: 'plateau-3', completedDate: '2026-09-05', summary: 'Bench press top completed set: 180 lb × 6.' },
        { id: 'plateau-4', completedDate: '2026-09-12', summary: 'Bench press top completed set: 185 lb × 5.' },
      ],
    },
    expectedReview: {
      contractVersion: 1,
      generationKey: 'fixture:apparent-plateau:2026-09-07:2026-09-13:v1',
      kind: 'weekly_review',
      authoredBy: 'WorkoutPal fixture coach',
      generatedAt: '2026-09-14T12:00:00.000Z',
      periodStart: '2026-09-07',
      periodEnd: '2026-09-13',
      latestWorkoutId: 'plateau-4',
      headline: 'Your recent bench performance is stable, but the record is too limited to call it a plateau.',
      journeyHighlight: { text: 'You maintained 185 lb for five completed reps across the recent comparison.', evidenceWorkoutIds: ['plateau-1', 'plateau-4'] },
      observations: [
        { category: 'progress', text: 'Recent top sets range from 180 lb × 6 to 185 lb × 6 without a sustained downward trend.', evidenceWorkoutIds: ['plateau-1', 'plateau-2', 'plateau-3', 'plateau-4'] },
        { category: 'uncertainty', text: 'Four once-weekly observations are not enough to distinguish a plateau from normal session variation.', evidenceWorkoutIds: [] },
      ],
      confidence: 'medium',
      limitations: ['Only four comparable bench sessions are available in this fixture.'],
      nextStep: { title: 'Repeat the current bench plan for another week', rationale: 'Another comparable session is more informative than changing a plan based on normal variation.' },
      contextUsed: [source('2026-08-22', '2026-09-12')],
    },
    evaluationNotes: {
      shouldRecognize: 'Stable recent performance with explicit uncertainty.',
      shouldAvoid: 'Calling a plateau or prescribing a deload from one lower session.',
    },
  },
  {
    id: 'inconsistent_weeks',
    purpose: 'Support continuity without guilt when recent training frequency has varied.',
    context: {
      generationKey: 'fixture:inconsistent-weeks:2026-09-07:2026-09-13:v1',
      periodStart: '2026-09-07',
      periodEnd: '2026-09-13',
      latestWorkoutId: 'inconsistent-3',
      goal: 'Build a sustainable two-day-per-week strength habit.',
      constraints: ['Two intended sessions per week', 'Work schedule varies'],
      completedWorkouts: [
        { id: 'inconsistent-1', completedDate: '2026-08-25', summary: 'One full-body session completed.' },
        { id: 'inconsistent-2', completedDate: '2026-09-02', summary: 'Two full-body sessions completed that week.' },
        { id: 'inconsistent-3', completedDate: '2026-09-11', summary: 'One full-body session completed this review week.' },
      ],
    },
    expectedReview: {
      contractVersion: 1,
      generationKey: 'fixture:inconsistent-weeks:2026-09-07:2026-09-13:v1',
      kind: 'weekly_review',
      authoredBy: 'WorkoutPal fixture coach',
      generatedAt: '2026-09-14T12:00:00.000Z',
      periodStart: '2026-09-07',
      periodEnd: '2026-09-13',
      latestWorkoutId: 'inconsistent-3',
      headline: 'You kept the training habit active during a variable week.',
      journeyHighlight: { text: 'You completed a full-body session instead of letting a constrained week become a full stop.', evidenceWorkoutIds: ['inconsistent-3'] },
      observations: [
        { category: 'consistency', text: 'Recent weeks contain one, two, and one completed sessions against a two-session intention.', evidenceWorkoutIds: ['inconsistent-1', 'inconsistent-2', 'inconsistent-3'] },
        { category: 'constraint', text: 'The completed record varies alongside the stated work-schedule constraint.', evidenceWorkoutIds: ['inconsistent-1', 'inconsistent-2', 'inconsistent-3'] },
      ],
      confidence: 'medium',
      limitations: ['WorkoutPal does not know which specific days were available.'],
      nextStep: { title: 'Protect one session and leave the second flexible', rationale: 'A reliable minimum keeps the habit continuous while preserving an achievable path to the two-session goal.' },
      contextUsed: [source('2026-08-25', '2026-09-11')],
    },
    evaluationNotes: {
      shouldRecognize: 'The completed session as continuity and the two-session week as evidence the goal can fit sometimes.',
      shouldAvoid: 'Broken-streak language, blame, or claiming unlogged sessions were missed.',
    },
  },
  {
    id: 'return_after_break',
    purpose: 'Recognize returning as progress and recommend a manageable re-entry.',
    context: {
      generationKey: 'fixture:return-after-break:2026-09-07:2026-09-13:v1',
      periodStart: '2026-09-07',
      periodEnd: '2026-09-13',
      latestWorkoutId: 'return-2',
      goal: 'Resume consistent strength training after time away.',
      constraints: ['First week back after five weeks without logged workouts'],
      completedWorkouts: [
        { id: 'return-0', completedDate: '2026-08-02', summary: 'Last workout before the logging gap.' },
        { id: 'return-1', completedDate: '2026-09-09', summary: 'Short full-body return session completed with reduced loads.' },
        { id: 'return-2', completedDate: '2026-09-12', summary: 'Second short full-body return session completed with reduced loads.' },
      ],
    },
    expectedReview: {
      contractVersion: 1,
      generationKey: 'fixture:return-after-break:2026-09-07:2026-09-13:v1',
      kind: 'weekly_review',
      authoredBy: 'WorkoutPal fixture coach',
      generatedAt: '2026-09-14T12:00:00.000Z',
      periodStart: '2026-09-07',
      periodEnd: '2026-09-13',
      latestWorkoutId: 'return-2',
      headline: 'You restarted your training with two manageable sessions this week.',
      journeyHighlight: { text: 'Completing a second session turned the return into the beginning of a new training block.', evidenceWorkoutIds: ['return-1', 'return-2'] },
      observations: [
        { category: 'consistency', text: 'Two completed sessions followed a five-week gap in the available WorkoutPal record.', evidenceWorkoutIds: ['return-0', 'return-1', 'return-2'] },
        { category: 'constraint', text: 'Both return sessions used intentionally reduced loads.', evidenceWorkoutIds: ['return-1', 'return-2'] },
      ],
      confidence: 'medium',
      limitations: ['WorkoutPal does not know why training paused or how recovery currently feels.'],
      nextStep: { title: 'Repeat the manageable two-session week', rationale: 'Re-establishing continuity is more useful than trying to recover volume from the time away.' },
      contextUsed: [source('2026-08-02', '2026-09-12')],
    },
    evaluationNotes: {
      shouldRecognize: 'Returning and completing the second session as meaningful progress.',
      shouldAvoid: 'Catch-up volume, assumptions about the break, or comparing current performance judgmentally with the pre-break session.',
    },
  },
  {
    id: 'tighter_time_constraints',
    purpose: 'Recognize maintained performance when shorter sessions better fit the user’s life.',
    context: {
      generationKey: 'fixture:tighter-time:2026-09-07:2026-09-13:v1',
      periodStart: '2026-09-07',
      periodEnd: '2026-09-13',
      latestWorkoutId: 'time-3',
      goal: 'Maintain strength while reducing sessions from 70 minutes to 45 minutes.',
      constraints: ['Two sessions per week', 'Maximum 45 minutes per session'],
      completedWorkouts: [
        { id: 'time-0', completedDate: '2026-08-30', summary: 'Previous 71-minute session; squat top completed set: 225 lb × 5.' },
        { id: 'time-1', completedDate: '2026-09-08', summary: 'Condensed session completed in 43 minutes; squat top completed set: 225 lb × 5.' },
        { id: 'time-3', completedDate: '2026-09-12', summary: 'Condensed session completed in 44 minutes; bench top completed set matched the prior week.' },
      ],
    },
    expectedReview: {
      contractVersion: 1,
      generationKey: 'fixture:tighter-time:2026-09-07:2026-09-13:v1',
      kind: 'weekly_review',
      authoredBy: 'WorkoutPal fixture coach',
      generatedAt: '2026-09-14T12:00:00.000Z',
      periodStart: '2026-09-07',
      periodEnd: '2026-09-13',
      latestWorkoutId: 'time-3',
      headline: 'The shorter format preserved your recent strength while fitting both sessions into 45 minutes.',
      journeyHighlight: { text: 'You completed both intended sessions within the new time limit.', evidenceWorkoutIds: ['time-1', 'time-3'] },
      observations: [
        { category: 'constraint', text: 'Session duration fell from 71 minutes to 43–44 minutes.', evidenceWorkoutIds: ['time-0', 'time-1', 'time-3'] },
        { category: 'progress', text: 'Your completed squat top set remained 225 lb × 5 after shortening the session.', evidenceWorkoutIds: ['time-0', 'time-1'] },
      ],
      confidence: 'medium',
      limitations: ['Only one week of condensed sessions is available.'],
      nextStep: { title: 'Repeat the condensed routine', rationale: 'A second week will show whether the time-efficient structure remains sustainable without sacrificing the maintenance goal.' },
      contextUsed: [source('2026-08-30', '2026-09-12')],
    },
    evaluationNotes: {
      shouldRecognize: 'Time saved and maintained performance as goal-relevant progress.',
      shouldAvoid: 'Calling maintenance a plateau or adding work that exceeds 45 minutes.',
    },
  },
];
