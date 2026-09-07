create extension if not exists pgcrypto;

create table public.exercises (
  id uuid primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null,
  equipment text not null,
  type text not null check (type in ('weighted','bodyweight')),
  is_custom boolean not null default true,
  archived boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint custom_exercise_owner check ((is_custom and owner_id is not null) or (not is_custom and owner_id is null))
);

create table public.routines (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived boolean not null default false
);

create table public.routine_exercises (
  id uuid primary key,
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  set_count integer not null check (set_count between 1 and 10),
  updated_at timestamptz not null
);

create table public.workout_sessions (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid,
  name text not null,
  status text not null check (status in ('active','completed')),
  started_at timestamptz not null,
  ended_at timestamptz,
  updated_at timestamptz not null,
  constraint completed_has_end check (status <> 'completed' or ended_at is not null)
);

create table public.workout_exercises (
  id uuid primary key,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null,
  exercise_name text not null,
  exercise_type text not null check (exercise_type in ('weighted','bodyweight')),
  sort_order integer not null check (sort_order >= 0),
  updated_at timestamptz not null
);

create table public.workout_sets (
  id uuid primary key,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number integer not null check (set_number > 0),
  weight numeric(7,2),
  reps integer check (reps > 0),
  unit text not null check (unit in ('lb','kg')),
  completed_at timestamptz,
  updated_at timestamptz not null
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unit text not null check (unit in ('lb','kg')),
  rest_seconds integer not null check (rest_seconds between 15 and 600),
  updated_at timestamptz not null
);

create index routines_owner on public.routines(owner_id, updated_at desc);
create index workouts_owner on public.workout_sessions(owner_id, ended_at desc);
create index routine_items on public.routine_exercises(routine_id, sort_order);
create index workout_items on public.workout_exercises(session_id, sort_order);
create index set_items on public.workout_sets(workout_exercise_id, set_number);

alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.user_preferences enable row level security;

create policy "read exercise library" on public.exercises for select to authenticated using (owner_id is null or owner_id = auth.uid());
create policy "insert own exercises" on public.exercises for insert to authenticated with check (owner_id = auth.uid() and is_custom);
create policy "update own exercises" on public.exercises for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and is_custom);
create policy "delete own exercises" on public.exercises for delete to authenticated using (owner_id = auth.uid());

create policy "read own routines" on public.routines for select to authenticated using (owner_id = auth.uid());
create policy "insert own routines" on public.routines for insert to authenticated with check (owner_id = auth.uid());
create policy "update own routines" on public.routines for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own routines" on public.routines for delete to authenticated using (owner_id = auth.uid());
create policy "manage own routine exercises" on public.routine_exercises for all to authenticated using (exists(select 1 from public.routines r where r.id=routine_id and r.owner_id=auth.uid())) with check (exists(select 1 from public.routines r where r.id=routine_id and r.owner_id=auth.uid()));

create policy "read own workouts" on public.workout_sessions for select to authenticated using (owner_id = auth.uid());
create policy "insert own workouts" on public.workout_sessions for insert to authenticated with check (owner_id = auth.uid());
create policy "update own workouts" on public.workout_sessions for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own active workouts" on public.workout_sessions for delete to authenticated using (owner_id = auth.uid() and status='active');
create policy "manage own workout exercises" on public.workout_exercises for all to authenticated using (exists(select 1 from public.workout_sessions w where w.id=session_id and w.owner_id=auth.uid())) with check (exists(select 1 from public.workout_sessions w where w.id=session_id and w.owner_id=auth.uid()));
create policy "manage own workout sets" on public.workout_sets for all to authenticated using (exists(select 1 from public.workout_exercises e join public.workout_sessions w on w.id=e.session_id where e.id=workout_exercise_id and w.owner_id=auth.uid())) with check (exists(select 1 from public.workout_exercises e join public.workout_sessions w on w.id=e.session_id where e.id=workout_exercise_id and w.owner_id=auth.uid()));

create policy "read own preferences" on public.user_preferences for select to authenticated using (user_id=auth.uid());
create policy "insert own preferences" on public.user_preferences for insert to authenticated with check (user_id=auth.uid());
create policy "update own preferences" on public.user_preferences for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

grant select on public.exercises to authenticated;
grant insert,update,delete on public.exercises to authenticated;
grant select,insert,update,delete on public.routines,public.routine_exercises,public.workout_sessions,public.workout_exercises,public.workout_sets,public.user_preferences to authenticated;
