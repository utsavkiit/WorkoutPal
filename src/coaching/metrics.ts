import { CoachReviewKind } from './contracts';
import { CoachingProfileV1 } from './goals';
import { ExerciseType, WorkoutSession } from '../types';

export const COACHING_METRICS_VERSION = 1 as const;
const KG_PER_LB = 0.45359237;

export interface ReviewPeriod {
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  timezone: string;
}

export interface ExercisePeriodMetric {
  exerciseId: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  workoutIds: string[];
  workingSets: number;
  totalReps: number;
  normalizedLoadKg: number | null;
  maxWeightKg: number | null;
  bestSetReps: number;
}

export interface WeeklyCoachingMetricsV1 {
  metricsVersion: typeof COACHING_METRICS_VERSION;
  period: ReviewPeriod;
  completedSessions: number;
  previousCompletedSessions: number;
  workingSets: number;
  previousWorkingSets: number;
  durationMinutes: number;
  previousDurationMinutes: number;
  workoutIds: string[];
  previousWorkoutIds: string[];
  latestWorkoutId: string | null;
  exercises: ExercisePeriodMetric[];
  previousExercises: ExercisePeriodMetric[];
  coverage: {
    firstWorkoutDate: string | null;
    lastWorkoutDate: string | null;
    totalCompletedWorkouts: number;
    comparableExerciseCount: number;
    hasExplicitSchedule: boolean;
    hasGoalBaseline: boolean;
  };
  recommendedKind: CoachReviewKind;
}

function localDateParts(timestamp: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(timestamp);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday'));
  return { date: `${value('year')}-${value('month')}-${value('day')}`, weekday };
}

function addDateDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function completedReviewPeriod(now: Date, reviewDay: number, timezone: string): ReviewPeriod {
  if (!Number.isInteger(reviewDay) || reviewDay < 0 || reviewDay > 6) throw new Error('reviewDay must be from 0 to 6.');
  const local = localDateParts(now, timezone);
  if (local.weekday < 0) throw new Error('Could not calculate the local weekday.');
  const boundary = addDateDays(local.date, -((local.weekday - reviewDay + 7) % 7));
  const endDate = addDateDays(boundary, -1);
  const startDate = addDateDays(boundary, -7);
  return { startDate, endDate, previousStartDate: addDateDays(startDate, -7), previousEndDate: addDateDays(endDate, -7), timezone };
}

function completedDate(workout: WorkoutSession, timezone: string) {
  if (workout.status !== 'completed' || !workout.endedAt) return null;
  const timestamp = new Date(workout.endedAt);
  return Number.isNaN(timestamp.getTime()) ? null : localDateParts(timestamp, timezone).date;
}

function inRange(value: string | null, start: string, end: string) {
  return value !== null && value >= start && value <= end;
}

function metricForWorkouts(workouts: WorkoutSession[]): ExercisePeriodMetric[] {
  const values = new Map<string, ExercisePeriodMetric>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const metric = values.get(exercise.exerciseId) ?? {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        exerciseType: exercise.exerciseType,
        workoutIds: [],
        workingSets: 0,
        totalReps: 0,
        normalizedLoadKg: exercise.exerciseType === 'weighted' ? 0 : null,
        maxWeightKg: exercise.exerciseType === 'weighted' ? 0 : null,
        bestSetReps: 0,
      };
      let used = false;
      for (const set of exercise.sets) {
        if (!set.completedAt || !set.reps || set.reps <= 0) continue;
        used = true;
        metric.workingSets += 1;
        metric.totalReps += set.reps;
        metric.bestSetReps = Math.max(metric.bestSetReps, set.reps);
        if (exercise.exerciseType === 'weighted' && set.weight !== null && set.weight >= 0) {
          const weightKg = set.unit === 'lb' ? set.weight * KG_PER_LB : set.weight;
          metric.normalizedLoadKg = (metric.normalizedLoadKg ?? 0) + weightKg * set.reps;
          metric.maxWeightKg = Math.max(metric.maxWeightKg ?? 0, weightKg);
        }
      }
      if (used && !metric.workoutIds.includes(workout.id)) metric.workoutIds.push(workout.id);
      if (used) values.set(exercise.exerciseId, metric);
    }
  }
  return [...values.values()].map((metric) => ({
    ...metric,
    normalizedLoadKg: metric.normalizedLoadKg === null ? null : Math.round(metric.normalizedLoadKg * 100) / 100,
    maxWeightKg: metric.maxWeightKg === null ? null : Math.round(metric.maxWeightKg * 100) / 100,
  })).sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

function durationMinutes(workouts: WorkoutSession[]) {
  return Math.round(workouts.reduce((total, workout) => {
    if (!workout.endedAt) return total;
    const duration = new Date(workout.endedAt).getTime() - new Date(workout.startedAt).getTime();
    return total + (Number.isFinite(duration) && duration > 0 ? duration / 60_000 : 0);
  }, 0));
}

export function calculateWeeklyCoachingMetrics(workouts: WorkoutSession[], profile: CoachingProfileV1, now = new Date()): WeeklyCoachingMetricsV1 {
  const period = completedReviewPeriod(now, profile.weeklyReview.dayOfWeek, profile.weeklyReview.timezone);
  const completed = workouts.filter((workout) => workout.status === 'completed' && workout.endedAt).sort((a, b) => a.endedAt!.localeCompare(b.endedAt!));
  const current = completed.filter((workout) => inRange(completedDate(workout, period.timezone), period.startDate, period.endDate));
  const previous = completed.filter((workout) => inRange(completedDate(workout, period.timezone), period.previousStartDate, period.previousEndDate));
  const exercises = metricForWorkouts(current);
  const previousExercises = metricForWorkouts(previous);
  const comparableExerciseCount = exercises.filter((metric) => previousExercises.some((candidate) => candidate.exerciseId === metric.exerciseId)).length;
  const activeGoal = profile.goals.find((goal) => goal.status === 'active' && goal.priority === 1);
  const hasGoalBaseline = activeGoal?.focus.type === 'specific_lift_strength' && activeGoal.focus.target !== null;
  const hasExplicitSchedule = profile.constraints.availableDaysPerWeek > 0;
  const workoutIds = current.map((workout) => workout.id);
  const workingSets = exercises.reduce((total, metric) => total + metric.workingSets, 0);
  const previousWorkingSets = previousExercises.reduce((total, metric) => total + metric.workingSets, 0);
  const hasComparison = comparableExerciseCount > 0 || hasExplicitSchedule || hasGoalBaseline;
  return {
    metricsVersion: COACHING_METRICS_VERSION,
    period,
    completedSessions: current.length,
    previousCompletedSessions: previous.length,
    workingSets,
    previousWorkingSets,
    durationMinutes: durationMinutes(current),
    previousDurationMinutes: durationMinutes(previous),
    workoutIds,
    previousWorkoutIds: previous.map((workout) => workout.id),
    latestWorkoutId: current.at(-1)?.id ?? null,
    exercises,
    previousExercises,
    coverage: {
      firstWorkoutDate: completed.length ? completedDate(completed[0], period.timezone) : null,
      lastWorkoutDate: completed.length ? completedDate(completed.at(-1)!, period.timezone) : null,
      totalCompletedWorkouts: completed.length,
      comparableExerciseCount,
      hasExplicitSchedule,
      hasGoalBaseline,
    },
    recommendedKind: current.length > 0 && workingSets > 0 && hasComparison ? 'weekly_review' : 'continuity_check_in',
  };
}
