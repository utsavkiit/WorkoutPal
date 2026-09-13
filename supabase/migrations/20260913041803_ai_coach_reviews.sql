create table public.coach_reviews (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  generation_key text not null,
  storage_version integer not null check (storage_version = 1),
  contract_version integer not null check (contract_version = 1),
  profile_id uuid not null,
  profile_revision integer not null,
  context_version integer not null check (context_version > 0),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  latest_workout_id uuid,
  payload jsonb not null,
  published_at timestamptz not null,
  archived_at timestamptz,
  unique(owner_id, generation_key),
  foreign key (profile_id, profile_revision)
    references public.coaching_profiles(profile_id, revision)
    on delete restrict,
  constraint coach_review_payload_shape check (
    jsonb_typeof(payload) = 'object'
    and (payload->>'storageVersion')::integer = storage_version
    and payload->>'id' = id::text
    and (payload->>'revision')::integer = 1
    and payload->>'generationKey' = generation_key
    and payload->>'profileId' = profile_id::text
    and (payload->>'profileRevision')::integer = profile_revision
    and (payload->>'contextVersion')::integer = context_version
    and (payload->'review'->>'contractVersion')::integer = contract_version
    and payload->'review'->>'generationKey' = generation_key
    and (payload->'review'->>'periodStart')::date = period_start
    and (payload->'review'->>'periodEnd')::date = period_end
    and (payload->'review'->>'latestWorkoutId') is not distinct from latest_workout_id::text
    and jsonb_typeof(payload->'review'->'observations') = 'array'
    and jsonb_typeof(payload->'review'->'contextUsed') = 'array'
  )
);

create index coach_reviews_owner_period on public.coach_reviews(owner_id, period_end desc, published_at desc);

alter table public.coach_reviews enable row level security;
revoke all on table public.coach_reviews from anon, authenticated;
grant select, insert on table public.coach_reviews to authenticated;
grant update(archived_at) on table public.coach_reviews to authenticated;

create policy "read own coach reviews"
on public.coach_reviews for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "insert own validated coach reviews"
on public.coach_reviews for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.coaching_profiles profile
    where profile.profile_id = coach_reviews.profile_id
      and profile.revision = coach_reviews.profile_revision
      and profile.owner_id = (select auth.uid())
  )
);

create policy "archive own coach reviews"
on public.coach_reviews for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
