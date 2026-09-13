create table public.coaching_profiles (
  profile_id uuid not null,
  revision integer not null check (revision > 0),
  owner_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null check (schema_version = 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  effective_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (profile_id, revision)
);

create table public.coaching_check_ins (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null,
  profile_revision integer not null,
  schema_version integer not null check (schema_version = 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  foreign key (profile_id, profile_revision)
    references public.coaching_profiles(profile_id, revision)
    on delete restrict
);

create index coaching_profiles_owner_latest
  on public.coaching_profiles(owner_id, effective_at desc, revision desc);
create index coaching_check_ins_owner_date
  on public.coaching_check_ins(owner_id, created_at desc);

alter table public.coaching_profiles enable row level security;
alter table public.coaching_check_ins enable row level security;

revoke all on table public.coaching_profiles, public.coaching_check_ins from anon, authenticated;
grant select, insert on table public.coaching_profiles to authenticated;
grant select, insert, update on table public.coaching_check_ins to authenticated;

create policy "read own coaching profiles"
on public.coaching_profiles for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "insert own coaching profiles"
on public.coaching_profiles for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "read own coaching check-ins"
on public.coaching_check_ins for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "insert own coaching check-ins"
on public.coaching_check_ins for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.coaching_profiles profile
    where profile.profile_id = coaching_check_ins.profile_id
      and profile.revision = coaching_check_ins.profile_revision
      and profile.owner_id = (select auth.uid())
  )
);

create policy "update own coaching check-ins"
on public.coaching_check_ins for update
to authenticated
using ((select auth.uid()) = owner_id)
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.coaching_profiles profile
    where profile.profile_id = coaching_check_ins.profile_id
      and profile.revision = coaching_check_ins.profile_revision
      and profile.owner_id = (select auth.uid())
  )
);
