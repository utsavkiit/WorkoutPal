import * as Network from 'expo-network';
import { Session } from '@supabase/supabase-js';
import { attachLocalOwner, completeOutbox, failOutbox, getOutbox, mergeRemoteData } from './database';
import { supabase } from './supabase';
import { Routine, WorkoutSession } from '../types';

const exerciseRow = (e: any, ownerId: string) => ({ id: e.id, owner_id: ownerId, name: e.name, muscle_group: e.muscleGroup, equipment: e.equipment, type: e.type, is_custom: true, archived: false, updated_at: e.updated_at });

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
      } else if (item.entity === 'workout') {
        const workout = payload as WorkoutSession;
        const result = await supabase.from('workout_sessions').upsert({ id: workout.id, owner_id: session.user.id, routine_id: workout.routineId, name: workout.name, status: workout.status, started_at: workout.startedAt, ended_at: workout.endedAt, updated_at: workout.updatedAt }); if (result.error) throw result.error;
        for (const exercise of workout.exercises) {
          const exerciseResult = await supabase.from('workout_exercises').upsert({ id: exercise.id, session_id: workout.id, exercise_id: exercise.exerciseId, exercise_name: exercise.exerciseName, exercise_type: exercise.exerciseType, sort_order: exercise.sortOrder, updated_at: workout.updatedAt }); if (exerciseResult.error) throw exerciseResult.error;
          if (exercise.sets.length) {
            const setResult = await supabase.from('workout_sets').upsert(exercise.sets.map((set) => ({ id: set.id, workout_exercise_id: exercise.id, set_number: set.setNumber, weight: set.weight, reps: set.reps, unit: set.unit, completed_at: set.completedAt, updated_at: set.updatedAt }))); if (setResult.error) throw setResult.error;
          }
        }
      }
      await completeOutbox(item.id);
    } catch (error) {
      failed = true;
      await failOutbox(item.id, error instanceof Error ? error.message : String(error));
    }
  }
  if (!failed) {
    const [exercises,routines,workouts,preference]=await Promise.all([
      supabase.from('exercises').select('*').eq('owner_id',session.user.id),
      supabase.from('routines').select('*,routine_exercises(*)').eq('owner_id',session.user.id),
      supabase.from('workout_sessions').select('*,workout_exercises(*,workout_sets(*))').eq('owner_id',session.user.id).eq('status','completed'),
      supabase.from('user_preferences').select('*').eq('user_id',session.user.id).maybeSingle(),
    ]);
    const pullError=exercises.error??routines.error??workouts.error??preference.error;
    if (pullError) failed=true;
    else await mergeRemoteData({exercises:exercises.data??[],routines:routines.data??[],workouts:workouts.data??[],preference:preference.data});
  }
  return failed ? 'error' as const : 'idle' as const;
}
