import { CoachingCheckInV1, CoachingProfileV1 } from './goals';
import { WeeklyCoachingMetricsV1 } from './metrics';
import { Routine, WorkoutSession } from '../types';

export const COACHING_CONTEXT_VERSION = 1 as const;
export const MAX_CONTEXT_WORKOUTS = 24;

export interface PriorReviewDecision {
  reviewId: string;
  usefulness: 'helpful' | 'not_helpful' | 'not_rated';
  tone: 'too_gentle' | 'right' | 'too_direct' | 'not_rated';
  note: string | null;
}

export interface CoachingContextV1 {
  contextVersion: typeof COACHING_CONTEXT_VERSION;
  contentTrust: 'workoutpal_structured_data_with_untrusted_user_text';
  generationKey: string;
  generatedAt: string;
  profile: CoachingProfileV1;
  currentRoutine: null | {
    id: string;
    name: string;
    version: string;
    exercises: { exerciseId: string; name: string; sortOrder: number; setCount: number }[];
  };
  metrics: WeeklyCoachingMetricsV1;
  evidenceWorkouts: {
    id: string;
    name: string;
    startedAt: string;
    endedAt: string;
    durationMinutes: number;
    exercises: {
      exerciseId: string;
      name: string;
      type: string;
      sets: { id: string; weight: number | null; reps: number; unit: string; completedAt: string }[];
    }[];
  }[];
  recentCheckIns: CoachingCheckInV1[];
  priorReviewDecision: PriorReviewDecision | null;
  truncation: { workoutsOmitted: number; checkInsOmitted: number };
}

function checksum(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function eligibleEvidence(workouts: WorkoutSession[], metrics: WeeklyCoachingMetricsV1) {
  const end = metrics.period.endDate;
  const localDate = (value: string) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: metrics.period.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
  return workouts.filter((workout) => workout.status === 'completed' && workout.endedAt && localDate(workout.endedAt) <= end)
    .sort((a, b) => b.endedAt!.localeCompare(a.endedAt!));
}

export function buildCoachingContext(input: {
  profile: CoachingProfileV1;
  metrics: WeeklyCoachingMetricsV1;
  workouts: WorkoutSession[];
  currentRoutine: Routine | null;
  checkIns?: CoachingCheckInV1[];
  priorReviewDecision?: PriorReviewDecision | null;
  generatedAt?: string;
}): CoachingContextV1 {
  if (!input.profile.consent.coachingEnabled || !input.profile.consent.shareWorkoutHistory) throw new Error('Coaching context requires explicit workout-history consent.');
  const eligible = eligibleEvidence(input.workouts, input.metrics);
  const included = eligible.slice(0, MAX_CONTEXT_WORKOUTS);
  const checkIns = input.profile.consent.includeCheckIns ? (input.checkIns ?? []).slice(0, 4) : [];
  const historyFingerprint = included.map((workout) => `${workout.id}:${workout.updatedAt}`).sort().join('|');
  const generationKey = [
    `coach-v${COACHING_CONTEXT_VERSION}`,
    input.profile.id,
    `r${input.profile.revision}`,
    input.metrics.period.startDate,
    input.metrics.period.endDate,
    input.metrics.latestWorkoutId ?? 'none',
    checksum(historyFingerprint),
  ].join(':');
  return {
    contextVersion: COACHING_CONTEXT_VERSION,
    contentTrust: 'workoutpal_structured_data_with_untrusted_user_text',
    generationKey,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    profile: input.profile,
    currentRoutine: input.currentRoutine ? {
      id: input.currentRoutine.id,
      name: input.currentRoutine.name,
      version: input.currentRoutine.updatedAt,
      exercises: input.currentRoutine.exercises.slice(0, 20).map((item) => ({ exerciseId: item.exerciseId, name: item.exercise?.name ?? 'Unknown exercise', sortOrder: item.sortOrder, setCount: item.setCount })),
    } : null,
    metrics: input.metrics,
    evidenceWorkouts: included.map((workout) => ({
      id: workout.id,
      name: workout.name,
      startedAt: workout.startedAt,
      endedAt: workout.endedAt!,
      durationMinutes: Math.max(0, Math.round((new Date(workout.endedAt!).getTime() - new Date(workout.startedAt).getTime()) / 60_000)),
      exercises: workout.exercises.slice(0, 20).map((exercise) => ({
        exerciseId: exercise.exerciseId,
        name: exercise.exerciseName,
        type: exercise.exerciseType,
        sets: exercise.sets.filter((set) => set.completedAt && set.reps && set.reps > 0).slice(0, 20).map((set) => ({ id: set.id, weight: set.weight, reps: set.reps!, unit: set.unit, completedAt: set.completedAt! })),
      })).filter((exercise) => exercise.sets.length > 0),
    })),
    recentCheckIns: checkIns,
    priorReviewDecision: input.priorReviewDecision ?? null,
    truncation: { workoutsOmitted: Math.max(0, eligible.length - included.length), checkInsOmitted: Math.max(0, (input.checkIns?.length ?? 0) - checkIns.length) },
  };
}
