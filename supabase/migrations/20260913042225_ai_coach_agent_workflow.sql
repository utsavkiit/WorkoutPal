create table public.coaching_generation_requests (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  generation_key text not null,
  request_version integer not null check (request_version = 1),
  context_version integer not null check (context_version > 0),
  profile_id uuid not null,
  profile_revision integer not null,
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  context jsonb not null check (
    jsonb_typeof(context) = 'object'
    and context->>'generationKey' = generation_key
    and (context->>'contextVersion')::integer = context_version
    and context->'profile'->>'id' = profile_id::text
    and (context->'profile'->>'revision')::integer = profile_revision
  ),
  status text not null check (status in ('pending','processing','ready','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) between 1 and 500),
  review_id uuid references public.coach_reviews(id) on delete set null,
  requested_at timestamptz not null,
  updated_at timestamptz not null,
  unique(owner_id, generation_key),
  foreign key (profile_id, profile_revision)
    references public.coaching_profiles(profile_id, revision)
    on delete restrict,
  constraint ready_request_has_review check (status <> 'ready' or review_id is not null)
);

create table public.coaching_agent_credentials (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index coaching_requests_pending on public.coaching_generation_requests(status, next_attempt_at, requested_at);

alter table public.coaching_generation_requests enable row level security;
alter table public.coaching_agent_credentials enable row level security;
revoke all on table public.coaching_generation_requests, public.coaching_agent_credentials from anon, authenticated;
grant select, insert, update on table public.coaching_generation_requests to authenticated;
grant select, insert, update(token_hash, updated_at, revoked_at) on table public.coaching_agent_credentials to authenticated;

create policy "read own coaching requests"
on public.coaching_generation_requests for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "insert own coaching requests"
on public.coaching_generation_requests for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and status = 'pending'
  and attempts = 0
  and review_id is null
  and exists (
    select 1 from public.coaching_profiles profile
    where profile.profile_id = coaching_generation_requests.profile_id
      and profile.revision = coaching_generation_requests.profile_revision
      and profile.owner_id = (select auth.uid())
      and (profile.payload->'consent'->>'coachingEnabled')::boolean
      and (profile.payload->'consent'->>'shareWorkoutHistory')::boolean
  )
);

create policy "retry own coaching requests"
on public.coaching_generation_requests for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "create own coaching credential"
on public.coaching_agent_credentials for insert
to authenticated
with check ((select auth.uid()) = owner_id and revoked_at is null);

create policy "read own coaching credential"
on public.coaching_agent_credentials for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "rotate or revoke own coaching credential"
on public.coaching_agent_credentials for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
