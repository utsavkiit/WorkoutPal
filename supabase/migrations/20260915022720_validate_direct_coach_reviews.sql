create or replace function public.coach_review_payload_is_valid_v1(
  p_payload jsonb,
  p_id uuid,
  p_generation_key text,
  p_profile_id uuid,
  p_profile_revision integer,
  p_context_version integer,
  p_period_start date,
  p_period_end date,
  p_latest_workout_id uuid,
  p_published_at timestamptz
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  review jsonb;
  item jsonb;
  evidence jsonb;
  cited_ids text[] := array[]::text[];
begin
  if jsonb_typeof(p_payload) <> 'object'
    or (select count(*) <> 9 or bool_or(key <> all(array['storageVersion','id','revision','profileId','profileRevision','contextVersion','generationKey','publishedAt','review'])) from jsonb_object_keys(p_payload) key)
    or (p_payload->>'storageVersion')::integer <> 1
    or p_payload->>'id' <> p_id::text
    or (p_payload->>'revision')::integer <> 1
    or p_payload->>'profileId' <> p_profile_id::text
    or (p_payload->>'profileRevision')::integer <> p_profile_revision
    or (p_payload->>'contextVersion')::integer <> p_context_version
    or p_payload->>'generationKey' <> p_generation_key
    or (p_payload->>'publishedAt')::timestamptz <> date_trunc('milliseconds', p_published_at)
  then return false; end if;

  review := p_payload->'review';
  if jsonb_typeof(review) <> 'object'
    or (select count(*) <> 15 or bool_or(key <> all(array['contractVersion','generationKey','kind','authoredBy','generatedAt','periodStart','periodEnd','latestWorkoutId','headline','journeyHighlight','observations','confidence','limitations','nextStep','contextUsed'])) from jsonb_object_keys(review) key)
    or (review->>'contractVersion')::integer <> 1
    or review->>'generationKey' <> p_generation_key
    or review->>'kind' not in ('weekly_review','continuity_check_in')
    or char_length(trim(review->>'authoredBy')) not between 1 and 100
    or (review->>'generatedAt')::timestamptz is null
    or (review->>'periodStart')::date <> p_period_start
    or (review->>'periodEnd')::date <> p_period_end
    or (review->>'latestWorkoutId') is distinct from p_latest_workout_id::text
    or char_length(trim(review->>'headline')) not between 1 and 180
    or review->>'confidence' not in ('low','medium','high')
  then return false; end if;

  if jsonb_typeof(review->'limitations') <> 'array' or jsonb_array_length(review->'limitations') > 5 then return false; end if;
  for item in select value from jsonb_array_elements(review->'limitations') loop
    if jsonb_typeof(item) <> 'string' or char_length(trim(item #>> '{}')) not between 1 and 300 then return false; end if;
  end loop;

  if jsonb_typeof(review->'nextStep') <> 'object'
    or (select count(*) <> 2 or bool_or(key <> all(array['title','rationale'])) from jsonb_object_keys(review->'nextStep') key)
    or char_length(trim(review->'nextStep'->>'title')) not between 1 and 120
    or char_length(trim(review->'nextStep'->>'rationale')) not between 1 and 500
  then return false; end if;

  if jsonb_typeof(review->'contextUsed') <> 'array' or jsonb_array_length(review->'contextUsed') not between 1 and 8 then return false; end if;
  for item in select value from jsonb_array_elements(review->'contextUsed') loop
    if jsonb_typeof(item) <> 'object'
      or (select count(*) <> 5 or bool_or(key <> all(array['source','label','status','startDate','endDate'])) from jsonb_object_keys(item) key)
      or item->>'source' not in ('workoutpal','external')
      or char_length(trim(item->>'label')) not between 1 and 120
      or item->>'status' not in ('used','stale','unavailable')
      or (jsonb_typeof(item->'startDate') not in ('string','null'))
      or (jsonb_typeof(item->'endDate') not in ('string','null'))
    then return false; end if;
    if jsonb_typeof(item->'startDate') = 'string' then perform (item->>'startDate')::date; end if;
    if jsonb_typeof(item->'endDate') = 'string' then perform (item->>'endDate')::date; end if;
  end loop;
  if not exists (select 1 from jsonb_array_elements(review->'contextUsed') source where source->>'source' = 'workoutpal') then return false; end if;

  if jsonb_typeof(review->'journeyHighlight') = 'null' then
    if review->>'kind' = 'weekly_review' then return false; end if;
  elsif jsonb_typeof(review->'journeyHighlight') <> 'object'
    or (select count(*) <> 2 or bool_or(key <> all(array['text','evidenceWorkoutIds'])) from jsonb_object_keys(review->'journeyHighlight') key)
    or char_length(trim(review->'journeyHighlight'->>'text')) not between 1 and 320
    or jsonb_typeof(review->'journeyHighlight'->'evidenceWorkoutIds') <> 'array'
    or jsonb_array_length(review->'journeyHighlight'->'evidenceWorkoutIds') not between 1 and 8
  then return false;
  else
    for evidence in select value from jsonb_array_elements(review->'journeyHighlight'->'evidenceWorkoutIds') loop
      if jsonb_typeof(evidence) <> 'string' or trim(evidence #>> '{}') = '' then return false; end if;
      cited_ids := array_append(cited_ids, evidence #>> '{}');
    end loop;
  end if;

  if jsonb_typeof(review->'observations') <> 'array'
    or jsonb_array_length(review->'observations') > (case when review->>'kind' = 'weekly_review' then 4 else 2 end)
    or (review->>'kind' = 'weekly_review' and jsonb_array_length(review->'observations') = 0)
  then return false; end if;
  for item in select value from jsonb_array_elements(review->'observations') loop
    if jsonb_typeof(item) <> 'object'
      or (select count(*) <> 3 or bool_or(key <> all(array['category','text','evidenceWorkoutIds'])) from jsonb_object_keys(item) key)
      or item->>'category' not in ('progress','consistency','constraint','uncertainty')
      or char_length(trim(item->>'text')) not between 1 and 500
      or jsonb_typeof(item->'evidenceWorkoutIds') <> 'array'
      or jsonb_array_length(item->'evidenceWorkoutIds') > 12
      or (item->>'category' <> 'uncertainty' and jsonb_array_length(item->'evidenceWorkoutIds') = 0)
    then return false; end if;
    for evidence in select value from jsonb_array_elements(item->'evidenceWorkoutIds') loop
      if jsonb_typeof(evidence) <> 'string' or trim(evidence #>> '{}') = '' then return false; end if;
      cited_ids := array_append(cited_ids, evidence #>> '{}');
    end loop;
  end loop;
  if cardinality(cited_ids) <> (select count(distinct id) from unnest(cited_ids) id) then return false; end if;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function public.coach_review_payload_is_valid_v1(jsonb,uuid,text,uuid,integer,integer,date,date,uuid,timestamptz) from public, anon, authenticated;

alter table public.coach_reviews
  add constraint coach_review_contract_v1_complete
  check (public.coach_review_payload_is_valid_v1(payload,id,generation_key,profile_id,profile_revision,context_version,period_start,period_end,latest_workout_id,published_at));

create or replace function public.publish_coach_review_v1(p_request_id uuid, p_review jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_row public.coaching_generation_requests%rowtype;
  v_review_id uuid;
  published_at timestamptz := date_trunc('milliseconds', clock_timestamp());
  canonical_review jsonb;
  stored_payload jsonb;
  evidence jsonb;
  cited_id text;
  allowed_ids text[];
begin
  select * into request_row from public.coaching_generation_requests where id = p_request_id;
  if not found then raise exception 'Coaching generation request not found'; end if;
  select id into v_review_id from public.coach_reviews where owner_id = request_row.owner_id and generation_key = request_row.generation_key;
  if v_review_id is not null then return v_review_id; end if;
  if request_row.status not in ('pending','processing') then raise exception 'Coaching generation request is not publishable'; end if;
  if jsonb_typeof(p_review) <> 'object'
    or (select count(*) <> 9 or bool_or(key <> all(array['kind','authoredBy','headline','journeyHighlight','observations','confidence','limitations','nextStep','contextUsed'])) from jsonb_object_keys(p_review) key)
  then raise exception 'Review input has unsupported or missing fields'; end if;

  canonical_review := p_review || jsonb_build_object(
    'contractVersion', 1,
    'generationKey', request_row.generation_key,
    'generatedAt', to_char(published_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'periodStart', request_row.period_start::text,
    'periodEnd', request_row.period_end::text,
    'latestWorkoutId', request_row.context->'metrics'->'latestWorkoutId'
  );
  v_review_id := gen_random_uuid();
  stored_payload := jsonb_build_object(
    'storageVersion', 1,
    'id', v_review_id,
    'revision', 1,
    'profileId', request_row.profile_id,
    'profileRevision', request_row.profile_revision,
    'contextVersion', request_row.context_version,
    'generationKey', request_row.generation_key,
    'publishedAt', to_char(published_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'review', canonical_review
  );
  if not public.coach_review_payload_is_valid_v1(stored_payload,v_review_id,request_row.generation_key,request_row.profile_id,request_row.profile_revision,request_row.context_version,request_row.period_start,request_row.period_end,(request_row.context->'metrics'->>'latestWorkoutId')::uuid,published_at)
  then raise exception 'Review does not match WorkoutPal contract v1'; end if;

  select coalesce(array_agg(value->>'id'), array[]::text[]) into allowed_ids from jsonb_array_elements(request_row.context->'evidenceWorkouts') value;
  for cited_id in
    select value #>> '{}' from jsonb_array_elements(coalesce(canonical_review->'journeyHighlight'->'evidenceWorkoutIds','[]'::jsonb)) value
    union all
    select evidence_id #>> '{}' from jsonb_array_elements(canonical_review->'observations') observation
      cross join lateral jsonb_array_elements(observation->'evidenceWorkoutIds') evidence_id
  loop
    if cited_id <> all(allowed_ids) then raise exception 'Review cites evidence outside the generation context'; end if;
  end loop;

  insert into public.coach_reviews (id,owner_id,generation_key,storage_version,contract_version,profile_id,profile_revision,context_version,period_start,period_end,latest_workout_id,payload,published_at)
  values (v_review_id,request_row.owner_id,request_row.generation_key,1,1,request_row.profile_id,request_row.profile_revision,request_row.context_version,request_row.period_start,request_row.period_end,(request_row.context->'metrics'->>'latestWorkoutId')::uuid,stored_payload,published_at);
  update public.coaching_generation_requests set status='ready',review_id=v_review_id,last_error=null,next_attempt_at=null,updated_at=published_at where id=p_request_id;
  return v_review_id;
end;
$$;

revoke all on function public.publish_coach_review_v1(uuid,jsonb) from public, anon, authenticated;
comment on function public.publish_coach_review_v1(uuid,jsonb) is
  'Trusted-agent publisher. Pass a pending request id and exactly these review keys: kind, authoredBy, headline, journeyHighlight, observations, confidence, limitations, nextStep, contextUsed. The function binds version, generation key, dates, latest workout, owner, and publication metadata and rejects evidence outside the request context.';
