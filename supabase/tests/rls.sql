-- Transaction-only fixtures: no accounts or workout data persist.
begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
insert into public.exercises(id,owner_id,name,muscle_group,equipment,type) select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'RLS fixture','Core','Bodyweight','bodyweight' from generate_series(1,2) n;
insert into public.routines(id,owner_id,name,created_at,updated_at) select id,owner_id,'RLS fixture',now(),now() from public.exercises where name='RLS fixture';
insert into public.routine_exercises(id,routine_id,exercise_id,sort_order,set_count,updated_at) select id,id,id,0,1,now() from public.routines where name='RLS fixture';
insert into public.workout_sessions(id,owner_id,name,status,started_at,updated_at) select id,owner_id,'RLS fixture','active',now(),now() from public.routines where name='RLS fixture';
insert into public.workout_exercises(id,session_id,exercise_id,exercise_name,exercise_type,sort_order,updated_at) select id,id,id,'RLS fixture','bodyweight',0,now() from public.routines where name='RLS fixture';
insert into public.workout_sets(id,workout_exercise_id,set_number,reps,unit,updated_at) select id,id,1,10,'lb',now() from public.routines where name='RLS fixture';
insert into public.user_preferences(user_id,unit,rest_seconds,updated_at) values ('10000000-0000-4000-8000-000000000001','lb',90,now()),('10000000-0000-4000-8000-000000000002','kg',90,now());
insert into public.workout_sessions(id,owner_id,name,status,started_at,ended_at,updated_at) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','RLS fixture completed','completed',now(),now(),now()),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','RLS fixture completed','completed',now(),now(),now());
insert into public.coaching_profiles(profile_id,revision,owner_id,schema_version,payload,effective_at,updated_at) values
  ('40000000-0000-4000-8000-000000000001',1,'10000000-0000-4000-8000-000000000001',1,'{"id":"40000000-0000-4000-8000-000000000001","revision":1,"consent":{"coachingEnabled":true,"shareWorkoutHistory":true}}',now(),now()),
  ('40000000-0000-4000-8000-000000000002',1,'10000000-0000-4000-8000-000000000002',1,'{"id":"40000000-0000-4000-8000-000000000002","revision":1,"consent":{"coachingEnabled":true,"shareWorkoutHistory":true}}',now(),now());
insert into public.coaching_check_ins(id,owner_id,profile_id,profile_revision,schema_version,payload,created_at,updated_at) values
  ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',1,1,'{}',now(),now()),
  ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002',1,1,'{}',now(),now());
create function pg_temp.coach_review_payload(review_id uuid, generation_key text, profile_id uuid, published_at timestamptz)
returns jsonb language sql as $$ select jsonb_build_object(
  'storageVersion',1,'id',review_id,'revision',1,'profileId',profile_id,'profileRevision',1,'contextVersion',1,
  'generationKey',generation_key,'publishedAt',to_char(published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'review',jsonb_build_object(
    'contractVersion',1,'generationKey',generation_key,'kind','continuity_check_in','authoredBy','RLS fixture',
    'generatedAt',to_char(published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'periodStart','2026-09-01','periodEnd','2026-09-07','latestWorkoutId',null,'headline','RLS fixture review',
    'journeyHighlight',null,'observations','[]'::jsonb,'confidence','low','limitations',jsonb_build_array('RLS fixture'),
    'nextStep',jsonb_build_object('title','Continue','rationale','RLS fixture'),
    'contextUsed',jsonb_build_array(jsonb_build_object('source','workoutpal','label','RLS fixture','status','used','startDate','2026-09-01','endDate','2026-09-07'))
  )
) $$;
insert into public.coach_reviews(id,owner_id,generation_key,storage_version,contract_version,profile_id,profile_revision,context_version,period_start,period_end,latest_workout_id,payload,published_at) values
  ('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','rls-owner-1',1,1,'40000000-0000-4000-8000-000000000001',1,1,'2026-09-01','2026-09-07',null,pg_temp.coach_review_payload('60000000-0000-4000-8000-000000000001','rls-owner-1','40000000-0000-4000-8000-000000000001',now()),now()),
  ('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','rls-owner-2',1,1,'40000000-0000-4000-8000-000000000002',1,1,'2026-09-01','2026-09-07',null,pg_temp.coach_review_payload('60000000-0000-4000-8000-000000000002','rls-owner-2','40000000-0000-4000-8000-000000000002',now()),now());
insert into public.coaching_generation_requests(id,owner_id,generation_key,request_version,context_version,profile_id,profile_revision,period_start,period_end,context,status,attempts,requested_at,updated_at) values
  ('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','request-owner-1',1,1,'40000000-0000-4000-8000-000000000001',1,'2026-09-01','2026-09-07',jsonb_build_object('generationKey','request-owner-1','contextVersion',1,'profile',jsonb_build_object('id','40000000-0000-4000-8000-000000000001','revision',1)),'pending',0,now(),now()),
  ('70000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','request-owner-2',1,1,'40000000-0000-4000-8000-000000000002',1,'2026-09-01','2026-09-07',jsonb_build_object('generationKey','request-owner-2','contextVersion',1,'profile',jsonb_build_object('id','40000000-0000-4000-8000-000000000002','revision',1)),'pending',0,now(),now());
insert into public.coaching_agent_credentials(owner_id,token_hash,created_at,updated_at) values
  ('10000000-0000-4000-8000-000000000001',repeat('a',64),now(),now()),
  ('10000000-0000-4000-8000-000000000002',repeat('b',64),now(),now());
insert into public.coach_review_feedback(id,owner_id,review_id,profile_id,profile_revision,feedback_version,payload,created_at,updated_at) values
  ('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',1,1,jsonb_build_object('feedbackVersion',1,'id','90000000-0000-4000-8000-000000000001','reviewId','60000000-0000-4000-8000-000000000001','profileId','40000000-0000-4000-8000-000000000001','profileRevision',1,'usefulness','helpful','tone','right'),now(),now()),
  ('90000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002',1,1,jsonb_build_object('feedbackVersion',1,'id','90000000-0000-4000-8000-000000000002','reviewId','60000000-0000-4000-8000-000000000002','profileId','40000000-0000-4000-8000-000000000002','profileRevision',1,'usefulness','helpful','tone','right'),now(),now());
insert into public.coaching_generation_requests(id,owner_id,generation_key,request_version,context_version,profile_id,profile_revision,period_start,period_end,context,status,attempts,review_id,requested_at,updated_at)
select ('71000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, r.owner_id, review.generation_key,1,1,
  ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,1,'2026-09-01','2026-09-07',
  jsonb_build_object('generationKey',review.generation_key,'contextVersion',1,'profile',jsonb_build_object('id','40000000-0000-4000-8000-'||lpad(n::text,12,'0'),'revision',1),
    'currentRoutine',jsonb_build_object('id',r.id,'name',r.name,'version',to_char(r.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'exercises',jsonb_build_array(jsonb_build_object('exerciseId',r.id,'name','RLS fixture','sortOrder',0,'setCount',1))),
    'exerciseCatalog',jsonb_build_array(jsonb_build_object('id',r.id,'name','RLS fixture','muscleGroup','Core','equipment','Bodyweight','type','bodyweight')),
    'evidenceWorkouts','[]'::jsonb),
  'ready',0,review.id,now(),now()
from generate_series(1,2) n
join public.routines r on r.id=('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
join public.coach_reviews review on review.id=('60000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
do $publish_proposal$
declare n integer; request_id uuid; proposal_id uuid; duplicate_id uuid;
begin
  for n in 1..2 loop
    request_id := ('71000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
    proposal_id := public.publish_coach_routine_proposal_v1(request_id,jsonb_build_object('name','RLS fixture next','summary','Keep the lift; give it a fresh name.',
      'exercises',jsonb_build_array(jsonb_build_object('exerciseId','20000000-0000-4000-8000-'||lpad(n::text,12,'0'),'setCount',1,'rationale','Keep this exercise.')),
      'removed','[]'::jsonb,'limitations','[]'::jsonb));
    duplicate_id := public.publish_coach_routine_proposal_v1(request_id,jsonb_build_object('name','Ignored duplicate','summary','A second publish should not change the first.',
      'exercises',jsonb_build_array(jsonb_build_object('exerciseId','20000000-0000-4000-8000-'||lpad(n::text,12,'0'),'setCount',1,'rationale','Keep this exercise.')),
      'removed','[]'::jsonb,'limitations','[]'::jsonb));
    if duplicate_id <> proposal_id then raise exception 'Proposal publication is not idempotent'; end if;
  end loop;
end $publish_proposal$;
insert into public.coach_reviews(id,owner_id,generation_key,storage_version,contract_version,profile_id,profile_revision,context_version,period_start,period_end,latest_workout_id,payload,published_at)
values('60000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','rls-proposal-invalid',1,1,'40000000-0000-4000-8000-000000000001',1,1,'2026-09-01','2026-09-07',null,
  pg_temp.coach_review_payload('60000000-0000-4000-8000-000000000003','rls-proposal-invalid','40000000-0000-4000-8000-000000000001',now()),now());
insert into public.coaching_generation_requests(id,owner_id,generation_key,request_version,context_version,profile_id,profile_revision,period_start,period_end,context,status,attempts,review_id,requested_at,updated_at)
select '71000000-0000-4000-8000-000000000003',owner_id,'rls-proposal-invalid',request_version,context_version,profile_id,profile_revision,period_start,period_end,
  jsonb_set(context,'{generationKey}','"rls-proposal-invalid"'::jsonb),'ready',0,'60000000-0000-4000-8000-000000000003',now(),now()
from public.coaching_generation_requests where id='71000000-0000-4000-8000-000000000001';
do $invalid_proposal$
declare accepted boolean; draft jsonb; request_id uuid := '71000000-0000-4000-8000-000000000003';
begin
  draft := jsonb_build_object('name','RLS fixture','summary','No real change.',
    'exercises',jsonb_build_array(jsonb_build_object('exerciseId','20000000-0000-4000-8000-000000000001','setCount',1,'rationale','Keep it.')),
    'removed','[]'::jsonb,'limitations','[]'::jsonb);
  accepted := false;
  begin perform public.publish_coach_routine_proposal_v1(request_id,draft); accepted := true; exception when others then null; end;
  if accepted then raise exception 'No-op routine proposal was published'; end if;
  draft := jsonb_set(draft,'{name}','"Changed name"'::jsonb);
  draft := jsonb_set(draft,'{exercises,0,rationale}','""'::jsonb);
  accepted := false;
  begin perform public.publish_coach_routine_proposal_v1(request_id,draft); accepted := true; exception when others then null; end;
  if accepted then raise exception 'Unexplained routine proposal was published'; end if;
  draft := jsonb_set(draft,'{exercises,0,rationale}','"Keep it."'::jsonb);
  draft := jsonb_set(draft,'{exercises,0,exerciseId}','"99999999-0000-4000-8000-000000000001"'::jsonb);
  accepted := false;
  begin perform public.publish_coach_routine_proposal_v1(request_id,draft); accepted := true; exception when others then null; end;
  if accepted then raise exception 'Unknown exercise routine proposal was published'; end if;
end $invalid_proposal$;
set local role authenticated;
do $test$
declare n integer; t text; own_id uuid; other_id uuid; own_user uuid; other_user uuid; c integer;
begin
for n in 1..2 loop
 own_id := ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
 other_id := ('20000000-0000-4000-8000-'||lpad((3-n)::text,12,'0'))::uuid;
 own_user := ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
 other_user := ('10000000-0000-4000-8000-'||lpad((3-n)::text,12,'0'))::uuid;
 perform set_config('request.jwt.claim.sub',own_user::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',own_user,'role','authenticated')::text,true);
 foreach t in array array['exercises','routines','routine_exercises','workout_sessions','workout_exercises','workout_sets'] loop
  execute format('select count(*) from public.%I where id=$1',t) into c using own_id;
  if c<>1 then raise exception 'Own row hidden in % for user %',t,n; end if;
  execute format('select count(*) from public.%I where id=$1',t) into c using other_id;
  if c<>0 then raise exception 'Other row exposed in %',t; end if;
  execute format('update public.%I set updated_at=now() where id=$1',t) using own_id;
  get diagnostics c=row_count;
  if c<>1 then raise exception 'Own update failed in %',t; end if;
  execute format('update public.%I set updated_at=now() where id=$1',t) using other_id;
  get diagnostics c=row_count;
  if c<>0 then raise exception 'Other update allowed in %',t; end if;
  execute format('delete from public.%I where id=$1',t) using other_id;
  get diagnostics c=row_count;
  if c<>0 then raise exception 'Other delete allowed in %',t; end if;
 end loop;
 select count(*) into c from public.user_preferences where user_id=own_user;
 if c<>1 then raise exception 'Own preferences hidden'; end if;
 select count(*) into c from public.user_preferences where user_id=other_user;
 if c<>0 then raise exception 'Other preferences exposed'; end if;
 begin
  update public.routines set owner_id=other_user where id=own_id;
  raise exception 'Owner reassignment allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.routine_exercises(id,routine_id,exercise_id,sort_order,set_count,updated_at) values(gen_random_uuid(),other_id,own_id,0,1,now());
  raise exception 'Cross-owner child insert allowed';
 exception when insufficient_privilege then null;
 end;
 select count(*) into c from public.exercises where not is_custom;
 if c<>78 then raise exception 'Catalog count mismatch: %',c; end if;
end loop;
end $test$;

-- A completed workout is deletable by its owner (widened from active-only) but not by another owner.
do $test_completed_delete$
declare mine uuid := '30000000-0000-4000-8000-000000000001'; theirs uuid := '30000000-0000-4000-8000-000000000002';
  owner1 uuid := '10000000-0000-4000-8000-000000000001'; c integer;
begin
  perform set_config('request.jwt.claim.sub',owner1::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',owner1,'role','authenticated')::text,true);
  delete from public.workout_sessions where id=theirs;
  get diagnostics c = row_count;
  if c<>0 then raise exception 'Other completed workout delete allowed'; end if;
  delete from public.workout_sessions where id=mine;
  get diagnostics c = row_count;
  if c<>1 then raise exception 'Own completed workout delete blocked'; end if;
end $test_completed_delete$;

do $test_coaching_rls$
declare owner1 uuid := '10000000-0000-4000-8000-000000000001'; owner2 uuid := '10000000-0000-4000-8000-000000000002'; c integer;
begin
  perform set_config('request.jwt.claim.sub',owner1::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',owner1,'role','authenticated')::text,true);
  select count(*) into c from public.coaching_profiles where profile_id='40000000-0000-4000-8000-000000000001';
  if c<>1 then raise exception 'Own coaching profile hidden'; end if;
  select count(*) into c from public.coaching_profiles where profile_id='40000000-0000-4000-8000-000000000002';
  if c<>0 then raise exception 'Other coaching profile exposed'; end if;
  select count(*) into c from public.coaching_check_ins where id='50000000-0000-4000-8000-000000000001';
  if c<>1 then raise exception 'Own coaching check-in hidden'; end if;
  select count(*) into c from public.coaching_check_ins where id='50000000-0000-4000-8000-000000000002';
  if c<>0 then raise exception 'Other coaching check-in exposed'; end if;
  update public.coaching_check_ins set updated_at=now() where id='50000000-0000-4000-8000-000000000002';
  get diagnostics c=row_count;
  if c<>0 then raise exception 'Other coaching check-in update allowed'; end if;
  begin
    update public.coaching_check_ins set owner_id=owner2 where id='50000000-0000-4000-8000-000000000001';
    raise exception 'Coaching check-in owner reassignment allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.coaching_check_ins(id,owner_id,profile_id,profile_revision,schema_version,payload,created_at,updated_at)
    values(gen_random_uuid(),owner1,'40000000-0000-4000-8000-000000000002',1,1,'{}',now(),now());
    raise exception 'Cross-owner coaching profile reference allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.coaching_profiles set updated_at=now() where profile_id='40000000-0000-4000-8000-000000000001';
    raise exception 'Immutable coaching profile update allowed';
  exception when insufficient_privilege then null;
  end;
end $test_coaching_rls$;

do $test_review_rls$
declare owner1 uuid := '10000000-0000-4000-8000-000000000001'; new_id uuid := gen_random_uuid(); c integer;
begin
  perform set_config('request.jwt.claim.sub',owner1::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',owner1,'role','authenticated')::text,true);
  select count(*) into c from public.coach_reviews where id='60000000-0000-4000-8000-000000000001';
  if c<>1 then raise exception 'Own coach review hidden'; end if;
  select count(*) into c from public.coach_reviews where id='60000000-0000-4000-8000-000000000002';
  if c<>0 then raise exception 'Other coach review exposed'; end if;
  update public.coach_reviews set archived_at=now() where id='60000000-0000-4000-8000-000000000001';
  get diagnostics c=row_count;
  if c<>1 then raise exception 'Own coach review archive blocked'; end if;
  update public.coach_reviews set archived_at=now() where id='60000000-0000-4000-8000-000000000002';
  get diagnostics c=row_count;
  if c<>0 then raise exception 'Other coach review archive allowed'; end if;
  begin
    update public.coach_reviews set payload='{}' where id='60000000-0000-4000-8000-000000000001';
    raise exception 'Immutable coach review payload update allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.coach_reviews(id,owner_id,generation_key,storage_version,contract_version,profile_id,profile_revision,context_version,period_start,period_end,payload,published_at)
    values(new_id,owner1,'cross-owner',1,1,'40000000-0000-4000-8000-000000000002',1,1,'2026-09-01','2026-09-07',pg_temp.coach_review_payload(new_id,'cross-owner','40000000-0000-4000-8000-000000000002',now()),now());
    raise exception 'Cross-owner coach review insert allowed';
  exception when insufficient_privilege then null;
  end;
end $test_review_rls$;

do $test_agent_workflow_rls$
declare owner1 uuid := '10000000-0000-4000-8000-000000000001'; owner2 uuid := '10000000-0000-4000-8000-000000000002'; c integer;
begin
  perform set_config('request.jwt.claim.sub',owner1::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',owner1,'role','authenticated')::text,true);
  select count(*) into c from public.coaching_generation_requests where id='70000000-0000-4000-8000-000000000001';
  if c<>1 then raise exception 'Own coaching request hidden'; end if;
  select count(*) into c from public.coaching_generation_requests where id='70000000-0000-4000-8000-000000000002';
  if c<>0 then raise exception 'Other coaching request exposed'; end if;
  begin
    update public.coaching_generation_requests set owner_id=owner2 where id='70000000-0000-4000-8000-000000000001';
    raise exception 'Coaching request owner reassignment allowed';
  exception when insufficient_privilege then null;
  end;
  select count(*) into c from public.coaching_agent_credentials where owner_id=owner1;
  if c<>1 then raise exception 'Own coaching credential hidden'; end if;
  select count(*) into c from public.coaching_agent_credentials where owner_id=owner2;
  if c<>0 then raise exception 'Other coaching credential exposed'; end if;
  begin
    update public.coaching_agent_credentials set owner_id=owner2 where owner_id=owner1;
    raise exception 'Coaching credential owner reassignment allowed';
  exception when insufficient_privilege then null;
  end;
end $test_agent_workflow_rls$;

do $test_feedback_rls$
declare owner1 uuid := '10000000-0000-4000-8000-000000000001'; owner2 uuid := '10000000-0000-4000-8000-000000000002'; c integer;
begin
  perform set_config('request.jwt.claim.sub',owner1::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',owner1,'role','authenticated')::text,true);
  select count(*) into c from public.coach_review_feedback where id='90000000-0000-4000-8000-000000000001';
  if c<>1 then raise exception 'Own coach feedback hidden'; end if;
  select count(*) into c from public.coach_review_feedback where id='90000000-0000-4000-8000-000000000002';
  if c<>0 then raise exception 'Other coach feedback exposed'; end if;
  update public.coach_review_feedback set updated_at=now() where id='90000000-0000-4000-8000-000000000002';
  get diagnostics c=row_count;
  if c<>0 then raise exception 'Other coach feedback update allowed'; end if;
  begin
    update public.coach_review_feedback set owner_id=owner2 where id='90000000-0000-4000-8000-000000000001';
    raise exception 'Coach feedback owner reassignment allowed';
  exception when insufficient_privilege then null;
  end;
end $test_feedback_rls$;

do $test_proposal_rls$
declare owner1 uuid := '10000000-0000-4000-8000-000000000001'; owner2 uuid := '10000000-0000-4000-8000-000000000002'; mine uuid; theirs uuid; c integer;
begin
  perform set_config('request.jwt.claim.sub',owner1::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',owner1,'role','authenticated')::text,true);
  select id into mine from public.coach_routine_proposals where owner_id=owner1;
  perform set_config('request.jwt.claim.sub',owner2::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',owner2,'role','authenticated')::text,true);
  select id into theirs from public.coach_routine_proposals where owner_id=owner2;
  perform set_config('request.jwt.claim.sub',owner1::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',owner1,'role','authenticated')::text,true);
  select count(*) into c from public.coach_routine_proposals where id=mine;
  if c<>1 then raise exception 'Own routine proposal hidden'; end if;
  select count(*) into c from public.coach_routine_proposals where id=theirs;
  if c<>0 then raise exception 'Other routine proposal exposed'; end if;
  update public.coach_routine_proposals set status='dismissed',decided_at=now() where id=theirs;
  get diagnostics c=row_count;
  if c<>0 then raise exception 'Other routine proposal decision allowed'; end if;
  begin
    update public.coach_routine_proposals set status='accepted',applied_routine_id='20000000-0000-4000-8000-000000000002',decided_at=now() where id=mine;
    raise exception 'Cross-owner routine application allowed';
  exception when insufficient_privilege then null;
  end;
  update public.coach_routine_proposals set status='accepted',applied_routine_id='20000000-0000-4000-8000-000000000001',decided_at=now() where id=mine;
  get diagnostics c=row_count;
  if c<>1 then raise exception 'Own routine proposal decision blocked'; end if;
  begin
    update public.coach_routine_proposals set payload='{}' where id=mine;
    raise exception 'Immutable routine proposal payload update allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.coach_routine_proposals(id,owner_id,review_id,generation_key,storage_version,proposal_version,payload,published_at)
      values(gen_random_uuid(),owner1,'60000000-0000-4000-8000-000000000001','rls-owner-1',1,1,'{}',now());
    raise exception 'Client routine proposal insert allowed';
  exception when insufficient_privilege then null;
  end;
end $test_proposal_rls$;

do $test_coaching_delete$
declare owner1 uuid := '10000000-0000-4000-8000-000000000001'; owner2 uuid := '10000000-0000-4000-8000-000000000002'; c integer;
begin
  perform set_config('request.jwt.claim.sub',owner1::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',owner1,'role','authenticated')::text,true);
  perform public.delete_my_coaching_data();
  select count(*) into c from public.coaching_profiles where owner_id=owner1;
  if c<>0 then raise exception 'Owner coaching deletion left profile data'; end if;
  select count(*) into c from public.coaching_profiles where owner_id=owner2;
  if c<>0 then raise exception 'Other profile unexpectedly visible under RLS'; end if;
  perform set_config('request.jwt.claim.sub',owner2::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',owner2,'role','authenticated')::text,true);
  select count(*) into c from public.coaching_profiles where owner_id=owner2;
  if c<>1 then raise exception 'Owner coaching deletion affected another user'; end if;
end $test_coaching_delete$;

reset role;
rollback;
select 'PASS: two-user workout and coaching isolation, immutable boundaries, scoped deletion, and RLS hold; fixtures rolled back' as result;
