-- PostgreSQL rechecks the row constraint when an authenticated owner archives a
-- review. The validator is immutable and reads only its arguments, so granting
-- EXECUTE exposes no additional data or mutation capability.
grant execute on function public.coach_review_payload_is_valid_v1(jsonb,uuid,text,uuid,integer,integer,date,date,uuid,timestamptz)
to authenticated;
