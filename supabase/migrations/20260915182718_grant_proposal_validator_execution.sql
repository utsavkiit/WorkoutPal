-- A CHECK constraint calls this pure validator on every proposal decision update.
-- It exposes no rows and grants no ability to publish or edit immutable content.
grant execute on function public.coach_routine_proposal_payload_is_valid_v1(jsonb,uuid,uuid,text,timestamptz)
to authenticated;
