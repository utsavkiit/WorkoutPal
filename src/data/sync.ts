import * as Network from 'expo-network';
import { Session } from '@supabase/supabase-js';
import { attachLocalOwner, completeOutbox, failOutbox, getOutbox, mergeRemoteData } from './database';
import { supabase } from './supabase';
import { Routine, WorkoutSession } from '../types';
import { CoachingCheckInV1, CoachingProfileV1 } from '../coaching/goals';
import { StoredCoachReviewV1 } from '../coaching/reviews';
import { CoachingGenerationRequestV1 } from '../coaching/workflow';
import { CoachReviewFeedbackV1 } from '../coaching/feedback';
import { isJwtIssuedAtFuture, retryJwtIssuedAtFuture } from './syncRetry';

const exerciseRow = (e: any, ownerId: string) => ({ id: e.id, owner_id: ownerId, name: e.name, muscle_group: e.muscleGroup, equipment: e.equipment, type: e.type, is_custom: true, archived: false, updated_at: e.updated_at });
const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  try { return JSON.stringify(error); } catch { return String(error); }
};

export async function pushPending(session: Session) {
  if (!supabase) return 'offline' as const;
  const client = supabase;
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
      } else if (item.entity === 'coach_review') {
        const record = payload as StoredCoachReviewV1;
        const { error } = await supabase.from('coach_reviews').upsert({
          id: record.id,
          owner_id: session.user.id,
          generation_key: record.generationKey,
          storage_version: record.storageVersion,
          contract_version: record.review.contractVersion,
          profile_id: record.profileId,
          profile_revision: record.profileRevision,
          context_version: record.contextVersion,
          period_start: record.review.periodStart,
          period_end: record.review.periodEnd,
          latest_workout_id: record.review.latestWorkoutId,
          payload: record,
          published_at: record.publishedAt,
        }, { onConflict: 'owner_id,generation_key', ignoreDuplicates: true });
        if (error) throw error;
      } else if (item.entity === 'coach_review_archive') {
        const { error } = await supabase.from('coach_reviews').update({ archived_at: payload.archived_at }).eq('id', item.entity_id).eq('owner_id', session.user.id);
        if (error) throw error;
      } else if (item.entity === 'coaching_request') {
        const request = payload as CoachingGenerationRequestV1;
        const { error } = await supabase.from('coaching_generation_requests').upsert({
          id: request.id,
          owner_id: session.user.id,
          generation_key: request.generationKey,
          request_version: request.requestVersion,
          context_version: request.context.contextVersion,
          profile_id: request.context.profile.id,
          profile_revision: request.context.profile.revision,
          period_start: request.context.metrics.period.startDate,
          period_end: request.context.metrics.period.endDate,
          context: request.context,
          status: 'pending',
          attempts: 0,
          requested_at: request.requestedAt,
          updated_at: request.updatedAt,
        }, { onConflict: 'owner_id,generation_key', ignoreDuplicates: true });
        if (error) throw error;
      } else if (item.entity === 'coaching_request_retry') {
        const { error } = await supabase.from('coaching_generation_requests').update({ status: 'pending', next_attempt_at: null, last_error: null, updated_at: payload.updated_at }).eq('id', item.entity_id).eq('owner_id', session.user.id).neq('status', 'ready');
        if (error) throw error;
      } else if(item.entity==='coach_review_feedback'){
        const feedback=payload as CoachReviewFeedbackV1;
        const {error}=await supabase.from('coach_review_feedback').upsert({id:feedback.id,owner_id:session.user.id,review_id:feedback.reviewId,profile_id:feedback.profileId,profile_revision:feedback.profileRevision,feedback_version:feedback.feedbackVersion,payload:feedback,created_at:feedback.createdAt,updated_at:feedback.updatedAt},{onConflict:'owner_id,review_id'});
        if(error)throw error;
      } else if(item.entity==='coach_proposal_decision'){
        const {error}=await supabase.from('coach_routine_proposals').update({status:payload.status,applied_routine_id:payload.applied_routine_id,decided_at:payload.decided_at}).eq('id',item.entity_id).eq('owner_id',session.user.id).eq('status','pending');
        if(error)throw error;
      } else if(item.entity==='coach_data_delete'){
        const {error}=await supabase.rpc('delete_my_coaching_data');
        if(error)throw error;
      }
      await completeOutbox(item.id);
    } catch (error) {
      failed = true;
      const message = errorMessage(error);
      if (isJwtIssuedAtFuture(error)) console.warn(`[sync] ${item.entity} ${item.operation} deferred because Supabase JWT validation is temporarily behind`);
      else console.error(`[sync] ${item.entity} ${item.operation} failed:`, message);
      await failOutbox(item.id, message);
    }
  }
  if (!failed) {
    const pull = () => Promise.all([
      client.from('exercises').select('*').eq('owner_id',session.user.id),
      client.from('routines').select('*,routine_exercises(*)').eq('owner_id',session.user.id),
      client.from('workout_sessions').select('*,workout_exercises(*,workout_sets(*))').eq('owner_id',session.user.id).eq('status','completed'),
      client.from('user_preferences').select('*').eq('user_id',session.user.id).maybeSingle(),
      client.from('coaching_profiles').select('*').eq('owner_id',session.user.id).order('effective_at', { ascending: false }),
      client.from('coaching_check_ins').select('*').eq('owner_id',session.user.id).order('created_at', { ascending: false }),
      client.from('coach_reviews').select('*').eq('owner_id',session.user.id).order('period_end', { ascending: false }),
      client.from('coaching_generation_requests').select('*').eq('owner_id',session.user.id).order('requested_at', { ascending: false }),
      client.from('coach_review_feedback').select('*').eq('owner_id',session.user.id).order('updated_at',{ascending:false}),
      client.from('coach_routine_proposals').select('*').eq('owner_id',session.user.id).order('published_at',{ascending:false}),
    ]);
    const pullErrorFor = ([exercises,routines,workouts,preference,coachingProfiles,coachingCheckIns,coachReviews,coachingRequests,coachFeedback,coachProposals]: Awaited<ReturnType<typeof pull>>) => exercises.error??routines.error??workouts.error??preference.error??coachingProfiles.error??coachingCheckIns.error??coachReviews.error??coachingRequests.error??coachFeedback.error??coachProposals.error;
    const [exercises,routines,workouts,preference,coachingProfiles,coachingCheckIns,coachReviews,coachingRequests,coachFeedback,coachProposals]=await retryJwtIssuedAtFuture(
      pull,
      pullErrorFor,
      { onRetry: (attempt, delayMs) => console.info(`[sync] Supabase JWT validation is temporarily behind; retrying pull ${attempt} after ${delayMs}ms`) },
    );
    const pullError=exercises.error??routines.error??workouts.error??preference.error??coachingProfiles.error??coachingCheckIns.error??coachReviews.error??coachingRequests.error??coachFeedback.error??coachProposals.error;
    if (pullError) {
      failed=true;
      if (isJwtIssuedAtFuture(pullError)) console.warn('[sync] pull deferred because Supabase JWT validation is temporarily behind');
      else console.error('[sync] pull failed:', pullError.message);
    } else {
      try {
        await mergeRemoteData({exercises:exercises.data??[],routines:routines.data??[],workouts:workouts.data??[],preference:preference.data,coachingProfiles:coachingProfiles.data??[],coachingCheckIns:coachingCheckIns.data??[],coachReviews:coachReviews.data??[],coachingRequests:coachingRequests.data??[],coachFeedback:coachFeedback.data??[],coachProposals:coachProposals.data??[]});
      } catch (error) {
        failed=true;
        console.error('[sync] merge failed:', errorMessage(error));
      }
      if (!failed) console.info('[sync] Supabase push and pull completed', {
        workouts: workouts.data?.length ?? 0,
        workoutExercises: (workouts.data ?? []).reduce((total, workout) => total + (workout.workout_exercises?.length ?? 0), 0),
        workoutSets: (workouts.data ?? []).reduce((total, workout) => total + (workout.workout_exercises ?? []).reduce((exerciseTotal: number, exercise: any) => exerciseTotal + (exercise.workout_sets?.length ?? 0), 0), 0),
      });
    }
  }
  return failed ? 'error' as const : 'idle' as const;
}
