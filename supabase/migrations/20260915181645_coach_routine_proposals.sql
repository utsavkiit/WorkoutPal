-- Agents can publish immutable pending recommendations. Only the app may adopt one.
create table public.coach_routine_proposals (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null unique references public.coach_reviews(id) on delete cascade,
  generation_key text not null,
  storage_version integer not null check (storage_version = 1),
  proposal_version integer not null check (proposal_version = 1),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','accepted','dismissed')),
  applied_routine_id uuid,
  decided_at timestamptz,
  published_at timestamptz not null,
  constraint coach_proposal_decision_shape check (
    (status = 'pending' and applied_routine_id is null and decided_at is null)
    or (status = 'dismissed' and applied_routine_id is null and decided_at is not null)
    or (status = 'accepted' and applied_routine_id is not null and decided_at is not null)
  )
);

create index coach_routine_proposals_owner_status on public.coach_routine_proposals(owner_id, status, published_at desc);

-- This function checks the immutable JSON, including the complete set of explanations.
-- The publisher additionally checks request ownership, consent, and exercise availability.
create function public.coach_routine_proposal_payload_is_valid_v1(
  p_payload jsonb, p_id uuid, p_review_id uuid, p_generation_key text, p_published_at timestamptz
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  source jsonb;
  draft jsonb;
  item jsonb;
  proposed_ids text[] := array[]::text[];
  removed_ids text[] := array[]::text[];
  source_ids text[] := array[]::text[];
  source_sets integer := 0;
  proposed_sets integer := 0;
  same_routine boolean := true;
  n integer := 0;
begin
  if jsonb_typeof(p_payload) <> 'object'
    or (select count(*) <> 7 or bool_or(key <> all(array['storageVersion','id','reviewId','generationKey','publishedAt','sourceRoutine','proposal'])) from jsonb_object_keys(p_payload) key)
    or (p_payload->>'storageVersion')::integer <> 1
    or (p_payload->>'id')::uuid <> p_id
    or (p_payload->>'reviewId')::uuid <> p_review_id
    or p_payload->>'generationKey' <> p_generation_key
    or (p_payload->>'publishedAt')::timestamptz <> date_trunc('milliseconds',p_published_at)
  then return false; end if;

  source := p_payload->'sourceRoutine';
  if jsonb_typeof(source) = 'null' then
    source := null;
  elsif jsonb_typeof(source) <> 'object'
    or (select count(*) <> 4 or bool_or(key <> all(array['id','name','version','exercises'])) from jsonb_object_keys(source) key)
    or (source->>'id')::uuid is null
    or char_length(trim(source->>'name')) not between 1 and 100
    or (source->>'version')::timestamptz is null
    or jsonb_typeof(source->'exercises') <> 'array'
    or jsonb_array_length(source->'exercises') > 20
  then return false; end if;
  if source is not null then
    for item in select value from jsonb_array_elements(source->'exercises') loop
      if jsonb_typeof(item) <> 'object'
        or (select count(*) <> 4 or bool_or(key <> all(array['exerciseId','name','sortOrder','setCount'])) from jsonb_object_keys(item) key)
        or (item->>'exerciseId')::uuid is null
        or char_length(trim(item->>'name')) not between 1 and 100
        or (item->>'sortOrder')::integer <> n
        or (item->>'setCount')::integer not between 1 and 10
      then return false; end if;
      source_ids := array_append(source_ids,item->>'exerciseId');
      source_sets := source_sets + (item->>'setCount')::integer;
      n := n + 1;
    end loop;
    if cardinality(source_ids) <> (select count(distinct id) from unnest(source_ids) id) then return false; end if;
  end if;

  draft := p_payload->'proposal';
  if jsonb_typeof(draft) <> 'object'
    or (select count(*) <> 6 or bool_or(key <> all(array['proposalVersion','name','summary','exercises','removed','limitations'])) from jsonb_object_keys(draft) key)
    or (draft->>'proposalVersion')::integer <> 1
    or char_length(trim(draft->>'name')) not between 1 and 100
    or char_length(trim(draft->>'summary')) not between 1 and 500
    or jsonb_typeof(draft->'exercises') <> 'array'
    or jsonb_array_length(draft->'exercises') not between 1 and 12
    or jsonb_typeof(draft->'removed') <> 'array'
    or jsonb_array_length(draft->'removed') > 20
    or jsonb_typeof(draft->'limitations') <> 'array'
    or jsonb_array_length(draft->'limitations') > 4
  then return false; end if;

  n := 0;
  for item in select value from jsonb_array_elements(draft->'exercises') loop
    if jsonb_typeof(item) <> 'object'
      or (select count(*) <> 3 or bool_or(key <> all(array['exerciseId','setCount','rationale'])) from jsonb_object_keys(item) key)
      or (item->>'exerciseId')::uuid is null
      or (item->>'setCount')::integer not between 1 and 6
      or char_length(trim(item->>'rationale')) not between 1 and 300
    then return false; end if;
    proposed_ids := array_append(proposed_ids,item->>'exerciseId');
    proposed_sets := proposed_sets + (item->>'setCount')::integer;
    if source is not null and (n >= cardinality(source_ids) or item->>'exerciseId' <> source_ids[n+1]
      or (item->>'setCount')::integer <> (source->'exercises'->n->>'setCount')::integer) then same_routine := false; end if;
    n := n + 1;
  end loop;
  if proposed_sets > 36 or (source is not null and proposed_sets > source_sets + 6)
    or cardinality(proposed_ids) <> (select count(distinct id) from unnest(proposed_ids) id)
  then return false; end if;

  for item in select value from jsonb_array_elements(draft->'removed') loop
    if jsonb_typeof(item) <> 'object'
      or (select count(*) <> 2 or bool_or(key <> all(array['exerciseId','rationale'])) from jsonb_object_keys(item) key)
      or (item->>'exerciseId')::uuid is null
      or char_length(trim(item->>'rationale')) not between 1 and 300
    then return false; end if;
    removed_ids := array_append(removed_ids,item->>'exerciseId');
  end loop;
  if cardinality(removed_ids) <> (select count(distinct id) from unnest(removed_ids) id)
    or cardinality(removed_ids) <> (select count(*) from unnest(source_ids) id where id <> all(proposed_ids))
    or exists(select 1 from unnest(removed_ids) id where id <> all(source_ids) or id = any(proposed_ids))
    or exists(select 1 from unnest(source_ids) id where id <> all(proposed_ids) and id <> all(removed_ids))
  then return false; end if;
  if source is not null and draft->>'name' = source->>'name' and cardinality(source_ids) = cardinality(proposed_ids) and same_routine then return false; end if;
  for item in select value from jsonb_array_elements(draft->'limitations') loop
    if jsonb_typeof(item) <> 'string' or char_length(trim(item #>> '{}')) not between 1 and 300 then return false; end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function public.coach_routine_proposal_payload_is_valid_v1(jsonb,uuid,uuid,text,timestamptz) from public, anon, authenticated;
alter table public.coach_routine_proposals add constraint coach_routine_proposal_contract_v1
  check (public.coach_routine_proposal_payload_is_valid_v1(payload,id,review_id,generation_key,published_at));

create function public.publish_coach_routine_proposal_v1(p_request_id uuid, p_proposal jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_row public.coaching_generation_requests%rowtype;
  review_row public.coach_reviews%rowtype;
  latest_consent jsonb;
  v_id uuid;
  v_time timestamptz := date_trunc('milliseconds',clock_timestamp());
  source jsonb;
  canonical jsonb;
  stored jsonb;
  item jsonb;
  exercise_id uuid;
begin
  select * into request_row from public.coaching_generation_requests where id=p_request_id for update;
  if not found then raise exception 'Coaching request not found'; end if;
  select id into v_id from public.coach_routine_proposals where review_id=request_row.review_id;
  if v_id is not null then return v_id; end if;
  if request_row.status <> 'ready' or request_row.review_id is null then raise exception 'Publish the review before its routine proposal'; end if;
  select * into review_row from public.coach_reviews where id=request_row.review_id and owner_id=request_row.owner_id and generation_key=request_row.generation_key;
  if not found then raise exception 'Request has no matching owned review'; end if;
  select payload->'consent' into latest_consent from public.coaching_profiles
    where owner_id=request_row.owner_id order by effective_at desc, revision desc limit 1;
  if latest_consent->>'coachingEnabled' <> 'true' or latest_consent->>'shareWorkoutHistory' <> 'true' then raise exception 'Coaching consent is disabled'; end if;
  if jsonb_typeof(p_proposal) <> 'object'
    or (select count(*) <> 5 or bool_or(key <> all(array['name','summary','exercises','removed','limitations'])) from jsonb_object_keys(p_proposal) key)
  then raise exception 'Proposal input has unsupported or missing fields'; end if;
  source := request_row.context->'currentRoutine';
  canonical := p_proposal || jsonb_build_object('proposalVersion',1);
  v_id := gen_random_uuid();
  stored := jsonb_build_object(
    'storageVersion',1,'id',v_id,'reviewId',request_row.review_id,
    'generationKey',request_row.generation_key,
    'publishedAt',to_char(v_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'sourceRoutine',source,'proposal',canonical
  );
  if not public.coach_routine_proposal_payload_is_valid_v1(stored,v_id,request_row.review_id,request_row.generation_key,v_time)
    then raise exception 'Proposal does not match WorkoutPal contract v1'; end if;
  for item in select value from jsonb_array_elements(canonical->'exercises') loop
    exercise_id := (item->>'exerciseId')::uuid;
    if not (
      exists(select 1 from jsonb_array_elements(coalesce(request_row.context->'exerciseCatalog','[]'::jsonb)) catalog where catalog->>'id'=exercise_id::text)
      or exists(select 1 from jsonb_array_elements(coalesce(source->'exercises','[]'::jsonb)) old_item where old_item->>'exerciseId'=exercise_id::text)
      or exists(select 1 from jsonb_array_elements(coalesce(request_row.context->'evidenceWorkouts','[]'::jsonb)) workout
        cross join lateral jsonb_array_elements(workout->'exercises') old_item where old_item->>'exerciseId'=exercise_id::text)
    ) then raise exception 'Proposal cites an exercise outside the generation context'; end if;
    if not exists(select 1 from public.exercises exercise where exercise.id=exercise_id and not exercise.archived
      and (exercise.owner_id is null or exercise.owner_id=request_row.owner_id))
      then raise exception 'Proposed exercise is not in the owner library'; end if;
  end loop;
  insert into public.coach_routine_proposals(id,owner_id,review_id,generation_key,storage_version,proposal_version,payload,published_at)
    values(v_id,request_row.owner_id,request_row.review_id,request_row.generation_key,1,1,stored,v_time);
  return v_id;
end;
$$;

revoke all on function public.publish_coach_routine_proposal_v1(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.publish_coach_routine_proposal_v1(uuid,jsonb) to service_role;
comment on function public.publish_coach_routine_proposal_v1(uuid,jsonb) is
  'Trusted-agent publisher. After a review is ready, pass its request id and exactly name, summary, exercises [{exerciseId,setCount,rationale}], removed [{exerciseId,rationale}], limitations. The database binds source routine, owner, review, IDs, version, and publication time.';

alter table public.coach_routine_proposals enable row level security;
revoke all on table public.coach_routine_proposals from anon, authenticated;
grant select on table public.coach_routine_proposals to authenticated;
grant update(status,applied_routine_id,decided_at) on table public.coach_routine_proposals to authenticated;

create policy "read own routine proposals" on public.coach_routine_proposals for select to authenticated
using ((select auth.uid())=owner_id);
create policy "decide own routine proposals" on public.coach_routine_proposals for update to authenticated
using ((select auth.uid())=owner_id and status='pending')
with check ((select auth.uid())=owner_id and status in ('accepted','dismissed')
  and (status='dismissed' or exists(select 1 from public.routines routine where routine.id=applied_routine_id and routine.owner_id=(select auth.uid()))));

-- Accepted saved routines remain user's data if coaching is later deleted.
create or replace function public.delete_my_coaching_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'Authentication required'; end if;
  delete from public.coaching_agent_credentials where owner_id=caller;
  delete from public.coach_routine_proposals where owner_id=caller;
  delete from public.coach_review_feedback where owner_id=caller;
  delete from public.coaching_generation_requests where owner_id=caller;
  delete from public.coach_reviews where owner_id=caller;
  delete from public.coaching_check_ins where owner_id=caller;
  delete from public.coaching_profiles where owner_id=caller;
end;
$$;
revoke all on function public.delete_my_coaching_data() from public, anon;
grant execute on function public.delete_my_coaching_data() to authenticated;
