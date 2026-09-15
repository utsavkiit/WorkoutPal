-- Limit the app to the four fields used by explicit retry. The service role used by
-- the narrow Edge Function retains its server-side privileges.
revoke update on table public.coaching_generation_requests from authenticated;
grant update(status, next_attempt_at, last_error, updated_at)
on table public.coaching_generation_requests to authenticated;

create or replace function public.delete_my_coaching_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'Authentication required'; end if;
  delete from public.coaching_agent_credentials where owner_id = caller;
  delete from public.coach_review_feedback where owner_id = caller;
  delete from public.coaching_generation_requests where owner_id = caller;
  delete from public.coach_reviews where owner_id = caller;
  delete from public.coaching_check_ins where owner_id = caller;
  delete from public.coaching_profiles where owner_id = caller;
end;
$$;

revoke all on function public.delete_my_coaching_data() from public, anon;
grant execute on function public.delete_my_coaching_data() to authenticated;
