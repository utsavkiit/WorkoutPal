create table public.coach_review_feedback (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null references public.coach_reviews(id) on delete cascade,
  profile_id uuid not null,
  profile_revision integer not null,
  feedback_version integer not null check (feedback_version = 1),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload->>'id' = id::text
    and payload->>'reviewId' = review_id::text
    and payload->>'profileId' = profile_id::text
    and (payload->>'profileRevision')::integer = profile_revision
    and (payload->>'feedbackVersion')::integer = feedback_version
    and payload->>'usefulness' in ('helpful','not_helpful')
    and payload->>'tone' in ('too_gentle','right','too_direct')
  ),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(owner_id, review_id),
  foreign key (profile_id, profile_revision) references public.coaching_profiles(profile_id, revision) on delete restrict
);

create index coach_review_feedback_owner_date on public.coach_review_feedback(owner_id, updated_at desc);
alter table public.coach_review_feedback enable row level security;
revoke all on table public.coach_review_feedback from anon, authenticated;
grant select, insert, update on table public.coach_review_feedback to authenticated;

create policy "read own coach feedback" on public.coach_review_feedback for select to authenticated
using ((select auth.uid()) = owner_id);
create policy "insert own coach feedback" on public.coach_review_feedback for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.coach_reviews review where review.id=review_id and review.owner_id=(select auth.uid()))
  and exists (select 1 from public.coaching_profiles profile where profile.profile_id=coach_review_feedback.profile_id and profile.revision=coach_review_feedback.profile_revision and profile.owner_id=(select auth.uid()))
);
create policy "update own coach feedback" on public.coach_review_feedback for update to authenticated
using ((select auth.uid()) = owner_id)
with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.coach_reviews review where review.id=review_id and review.owner_id=(select auth.uid()))
  and exists (select 1 from public.coaching_profiles profile where profile.profile_id=coach_review_feedback.profile_id and profile.revision=coach_review_feedback.profile_revision and profile.owner_id=(select auth.uid()))
);
