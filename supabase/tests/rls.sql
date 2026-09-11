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
reset role;
rollback;
select 'PASS: two-user RLS read/update/delete isolation, ownership reassignment and cross-owner child insert checks; fixtures rolled back' as result;
