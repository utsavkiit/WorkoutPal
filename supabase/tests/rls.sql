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
  ('40000000-0000-4000-8000-000000000001',1,'10000000-0000-4000-8000-000000000001',1,'{}',now(),now()),
  ('40000000-0000-4000-8000-000000000002',1,'10000000-0000-4000-8000-000000000002',1,'{}',now(),now());
insert into public.coaching_check_ins(id,owner_id,profile_id,profile_revision,schema_version,payload,created_at,updated_at) values
  ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',1,1,'{}',now(),now()),
  ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002',1,1,'{}',now(),now());
insert into public.coach_reviews(id,owner_id,generation_key,storage_version,contract_version,profile_id,profile_revision,context_version,period_start,period_end,latest_workout_id,payload,published_at) values
  ('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','rls-owner-1',1,1,'40000000-0000-4000-8000-000000000001',1,1,'2026-09-01','2026-09-07',null,jsonb_build_object('storageVersion',1,'id','60000000-0000-4000-8000-000000000001','revision',1,'profileId','40000000-0000-4000-8000-000000000001','profileRevision',1,'contextVersion',1,'generationKey','rls-owner-1','review',jsonb_build_object('contractVersion',1,'generationKey','rls-owner-1','periodStart','2026-09-01','periodEnd','2026-09-07','latestWorkoutId',null,'observations','[]'::jsonb,'contextUsed','[]'::jsonb)),now()),
  ('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','rls-owner-2',1,1,'40000000-0000-4000-8000-000000000002',1,1,'2026-09-01','2026-09-07',null,jsonb_build_object('storageVersion',1,'id','60000000-0000-4000-8000-000000000002','revision',1,'profileId','40000000-0000-4000-8000-000000000002','profileRevision',1,'contextVersion',1,'generationKey','rls-owner-2','review',jsonb_build_object('contractVersion',1,'generationKey','rls-owner-2','periodStart','2026-09-01','periodEnd','2026-09-07','latestWorkoutId',null,'observations','[]'::jsonb,'contextUsed','[]'::jsonb)),now());
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
    values(new_id,owner1,'cross-owner',1,1,'40000000-0000-4000-8000-000000000002',1,1,'2026-09-01','2026-09-07',jsonb_build_object('storageVersion',1,'id',new_id,'revision',1,'profileId','40000000-0000-4000-8000-000000000002','profileRevision',1,'contextVersion',1,'generationKey','cross-owner','review',jsonb_build_object('contractVersion',1,'generationKey','cross-owner','periodStart','2026-09-01','periodEnd','2026-09-07','latestWorkoutId',null,'observations','[]'::jsonb,'contextUsed','[]'::jsonb)),now());
    raise exception 'Cross-owner coach review insert allowed';
  exception when insufficient_privilege then null;
  end;
end $test_review_rls$;

reset role;
rollback;
select 'PASS: two-user workout and coaching RLS isolation, immutable profile revisions, ownership boundaries, and completed-workout delete checks; fixtures rolled back' as result;
