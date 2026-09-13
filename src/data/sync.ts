import * as Network from 'expo-network';
import { Session } from '@supabase/supabase-js';
import { attachLocalOwner, completeOutbox, failOutbox, getOutbox, mergeRemoteData } from './database';
import { supabase } from './supabase';
import { Routine, WorkoutSession } from '../types';
import { CoachingCheckInV1, CoachingProfileV1 } from '../coaching/goals';

const exerciseRow = (e: any, ownerId: string) => ({ id: e.id, owner_id: ownerId, name: e.name, muscle_group: e.muscleGroup, equipment: e.equipment, type: e.type, is_custom: true, archived: false, updated_at: e.updated_at });
const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  try { return JSON.stringify(error); } catch { return String(error); }
};

export async function pushPending(session: Session) {
  if (!supabase) return 'offline' as const;
  const network = await Network.getNetworkStateAsync();
  if (!network.isConnected) return 'offline' as const;
  await attachLocalOwner(session.user.id);
  let failed = false;
  for (const item of await getOutbox()) {
    try {
      const payload = JSON.parse(item.payload);
      if (item.entity === 'exercise') {
        const { error } = await supabase.from('exercises').upsert(exerciseRow(payload, session.user.id)); if (error) throw error;
      } else if (item.entity === 'preference') {
        const { error } = await supabase.from('user_preferences').upsert({ user_id: session.user.id, ...payload }); if (error) throw error;
      } else if (item.entity === 'routine' && item.operation === 'delete') {
        const { error } = await supabase.from('routines').update({ archived: true, updated_at: payload.updated_at }).eq('id', item.entity_id).eq('owner_id', session.user.id); if (error) throw error;
      } else if (item.entity === 'routine') {
        const routine = payload as Routine;
        const { error } = await supabase.from('routines').upsert({ id: routine.id, owner_id: session.user.id, name: routine.name, created_at: routine.createdAt, updated_at: routine.updatedAt, archived: routine.archived }); if (error) throw error;
        const remove = await supabase.from('routine_exercises').delete().eq('routine_id', routine.id); if (remove.error) throw remove.error;
        if (routine.exercises.length) {
          const result = await supabase.from('routine_exercises').insert(routine.exercises.map((e) => ({ id: e.id, routine_id: routine.id, exercise_id: e.exerciseId, sort_order: e.sortOrder, set_count: e.setCount, updated_at: routine.updatedAt })));
          if (result.error) throw result.error;
        }
      } else if (item.entity === 'workout' && item.operation === 'delete') {
        const { error } = await supabase.from('workout_sessions').delete().eq('id', item.entity_id).eq('owner_id', session.user.id); if (error) throw error;
      } else if (item.entity === 'workout_exercise' && item.operation === 'delete') {
        const { error } = await supabase.from('workout_exercises').delete().eq('id', item.entity_id); if (error) throw error;
      } else if (item.entity === 'workout_set' && item.operation === 'delete') {
        const { error } = await supabase.from('workout_sets').delete().eq('id', item.entity_id); if (error) throw error;
      } else if (item.entity === 'workout') {
        const workout = payload as WorkoutSession;
        const result = await supabase.from('workout_sessions').upsert({ id: workout.id, owner_id: session.user.id, routine_id: workout.routineId, name: workout.name, status: workout.status, started_at: workout.startedAt, ended_at: workout.endedAt, updated_at: workout.updatedAt }); if (result.error) throw result.error;
        for (const exercise of workout.exercises) {
          const exerciseResult = await supabase.from('workout_exercises').upsert({ id: exercise.id, session_id: workout.id, exercise_id: exercise.exerciseId, exercise_name: exercise.exerciseName, exercise_type: exercise.exerciseType, sort_order: exercise.sortOrder, updated_at: workout.updatedAt }); if (exerciseResult.error) throw exerciseResult.error;
          if (exercise.sets.length) {
            const setResult = await supabase.from('workout_sets').upsert(exercise.sets.map((set) => ({ id: set.id, workout_exercise_id: exercise.id, set_number: set.setNumber, weight: set.weight, reps: set.reps, unit: set.unit, completed_at: set.completedAt, updated_at: set.updatedAt }))); if (setResult.error) throw setResult.error;
          }
        }
      } else if (item.entity === 'coaching_profile') {
        const profile = payload as CoachingProfileV1;
        const { error } = await supabase.from('coaching_profiles').upsert({
          profile_id: profile.id,
          revision: profile.revision,
          owner_id: session.user.id,
          schema_version: profile.schemaVersion,
          payload: profile,
          effective_at: profile.effectiveAt,
          updated_at: profile.updatedAt,
        }, { onConflict: 'profile_id,revision', ignoreDuplicates: true });
        if (error) throw error;
      } else if (item.entity === 'coaching_check_in') {
        const checkIn = payload as CoachingCheckInV1;
        const { error } = await supabase.from('coaching_check_ins').upsert({
          id: checkIn.id,
          owner_id: session.user.id,
          profile_id: checkIn.profileId,
          profile_revision: checkIn.profileRevision,
          schema_version: checkIn.schemaVersion,
          payload: checkIn,
          created_at: checkIn.createdAt,
          updated_at: checkIn.updatedAt,
        }, { onConflict: 'id' });
        if (error) throw error;
      }
      await completeOutbox(item.id);
    } catch (error) {
      failed = true;
      const message = errorMessage(error);
      console.error(`[sync] ${item.entity} ${item.operation} failed:`, message);
      await failOutbox(item.id, message);
    }
  }
  if (!failed) {
    const [exercises,routines,workouts,preference,coachingProfiles,coachingCheckIns]=await Promise.all([
      supabase.from('exercises').select('*').eq('owner_id',session.user.id),
      supabase.from('routines').select('*,routine_exercises(*)').eq('owner_id',session.user.id),
      supabase.from('workout_sessions').select('*,workout_exercises(*,workout_sets(*))').eq('owner_id',session.user.id).eq('status','completed'),
      supabase.from('user_preferences').select('*').eq('user_id',session.user.id).maybeSingle(),
      supabase.from('coaching_profiles').select('*').eq('owner_id',session.user.id).order('effective_at', { ascending: false }),
      supabase.from('coaching_check_ins').select('*').eq('owner_id',session.user.id).order('created_at', { ascending: false }),
    ]);
    const pullError=exercises.error??routines.error??workouts.error??preference.error??coachingProfiles.error??coachingCheckIns.error;
    if (pullError) {
      failed=true;
      console.error('[sync] pull failed:', pullError.message);
    } else {
      await mergeRemoteData({exercises:exercises.data??[],routines:routines.data??[],workouts:workouts.data??[],preference:preference.data,coachingProfiles:coachingProfiles.data??[],coachingCheckIns:coachingCheckIns.data??[]});
      console.info('[sync] Supabase push and pull completed', {
        workouts: workouts.data?.length ?? 0,
        workoutExercises: (workouts.data ?? []).reduce((total, workout) => total + (workout.workout_exercises?.length ?? 0), 0),
        workoutSets: (workouts.data ?? []).reduce((total, workout) => total + (workout.workout_exercises ?? []).reduce((exerciseTotal: number, exercise: any) => exerciseTotal + (exercise.workout_sets?.length ?? 0), 0), 0),
      });
    }
  }
  return failed ? 'error' as const : 'idle' as const;
}
