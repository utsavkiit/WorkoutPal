import { Exercise, Routine, UserPreferences, WorkoutSession } from '../types';
import * as local from './database';

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

export const repositories = {
  exercises: { list: local.listExercises, create: local.createCustomExercise } satisfies ExerciseRepository,
  routines: { list: local.listRoutines, get: local.getRoutine, save: local.saveRoutine, archive: local.archiveRoutine } satisfies RoutineRepository,
  workouts: { active: local.getActiveWorkout, history: local.listHistory, start: local.createWorkout, finish: local.finishWorkout, discard: local.discardWorkout } satisfies WorkoutRepository,
  preferences: { get: local.getPreferences, save: local.savePreferences } satisfies PreferencesRepository,
};
