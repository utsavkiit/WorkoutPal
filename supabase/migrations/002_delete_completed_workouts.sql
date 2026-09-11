-- Widen workout_sessions delete access from active-only to any status, so a user can
-- permanently delete a completed workout from history (previously only active/in-progress
-- workouts could be deleted). Ownership remains enforced.
drop policy "delete own active workouts" on public.workout_sessions;
create policy "delete own workouts" on public.workout_sessions for delete to authenticated using (owner_id = auth.uid());
