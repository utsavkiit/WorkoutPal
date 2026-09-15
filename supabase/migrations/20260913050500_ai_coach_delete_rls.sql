-- Keep the deletion RPC under normal RLS enforcement so it does not need elevated
-- execution privileges. Direct deletes remain strictly owner-scoped.
create or replace function public.delete_my_coaching_data()
returns void
language plpgsql
security invoker
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

grant delete on table public.coaching_agent_credentials, public.coach_review_feedback,
  public.coaching_generation_requests, public.coach_reviews, public.coaching_check_ins,
  public.coaching_profiles to authenticated;

create policy "delete own coaching credential"
on public.coaching_agent_credentials for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy "delete own coach feedback"
on public.coach_review_feedback for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy "delete own coaching requests"
on public.coaching_generation_requests for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy "delete own coach reviews"
on public.coach_reviews for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy "delete own coaching check-ins"
on public.coaching_check_ins for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy "delete own coaching profiles"
on public.coaching_profiles for delete to authenticated
using ((select auth.uid()) = owner_id);
