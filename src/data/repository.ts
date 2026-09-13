import { Exercise, Routine, UserPreferences, WorkoutSession } from '../types';
import * as local from './database';
import { CoachingCheckInV1, CoachingProfileV1 } from '../coaching/goals';
import { StoredCoachReviewV1 } from '../coaching/reviews';

export interface ExerciseRepository {
  list(search?: string, muscle?: string): Promise<Exercise[]>;
  create(input: Parameters<typeof local.createCustomExercise>[0]): Promise<string>;
}
export interface RoutineRepository {
  list(): Promise<Routine[]>;
  get(id: string): Promise<Routine | null>;
  save(input: Parameters<typeof local.saveRoutine>[0]): Promise<string>;
  archive(id: string): Promise<void>;
}
export interface WorkoutRepository {
  active(): Promise<WorkoutSession | null>;
  history(): Promise<WorkoutSession[]>;
  start(routineId: string | null): Promise<string>;
  finish(id: string): Promise<void>;
  discard(id: string): Promise<void>;
}
export interface PreferencesRepository {
  get(): Promise<UserPreferences>;
  save(input: Pick<UserPreferences,'unit'|'restSeconds'>): Promise<void>;
}
export interface CoachingRepository {
  currentProfile(): Promise<CoachingProfileV1 | null>;
  profileRevisions(profileId?: string): Promise<CoachingProfileV1[]>;
  saveProfile(profile: CoachingProfileV1): Promise<void>;
  checkIns(profileId?: string): Promise<CoachingCheckInV1[]>;
  saveCheckIn(checkIn: CoachingCheckInV1): Promise<void>;
  weeklyMetrics(at?: Date): ReturnType<typeof local.getWeeklyCoachingMetrics>;
  context(at?: Date): ReturnType<typeof local.getCoachingContext>;
  reviews(includeArchived?: boolean): ReturnType<typeof local.listCoachReviews>;
  review(id: string): ReturnType<typeof local.getCoachReview>;
  saveReview(review: StoredCoachReviewV1): Promise<string>;
  archiveReview(id: string): Promise<void>;
}

export const repositories = {
  exercises: { list: local.listExercises, create: local.createCustomExercise } satisfies ExerciseRepository,
  routines: { list: local.listRoutines, get: local.getRoutine, save: local.saveRoutine, archive: local.archiveRoutine } satisfies RoutineRepository,
  workouts: { active: local.getActiveWorkout, history: local.listHistory, start: local.createWorkout, finish: local.finishWorkout, discard: local.discardWorkout } satisfies WorkoutRepository,
  preferences: { get: local.getPreferences, save: local.savePreferences } satisfies PreferencesRepository,
  coaching: {
    currentProfile: local.getCurrentCoachingProfile,
    profileRevisions: local.listCoachingProfileRevisions,
    saveProfile: local.saveCoachingProfileRevision,
    checkIns: local.listCoachingCheckIns,
    saveCheckIn: local.saveCoachingCheckIn,
    weeklyMetrics: local.getWeeklyCoachingMetrics,
    context: local.getCoachingContext,
    reviews: local.listCoachReviews,
    review: local.getCoachReview,
    saveReview: local.saveCoachReview,
    archiveReview: local.archiveCoachReview,
  } satisfies CoachingRepository,
};
