import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const text = (value: unknown, maximum: number) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum;
const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
const timestamp = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
const record = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value);
const unexpected = (value: Record<string, any>, allowed: string[]) => Object.keys(value).filter((key) => !allowed.includes(key));
function strings(value: unknown, maximum: number) {
  return Array.isArray(value) && value.length <= maximum && value.every((item) => typeof item === 'string' && item.trim()) && new Set(value).size === value.length;
}

function serviceKey() {
  const named = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (named) return Object.values(JSON.parse(named))[0] as string;
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validateDraft(value: unknown, context: Record<string, any>) {
  const errors: string[] = [];
  if (!record(value)) return ['review must be an object'];
  const review = value as Record<string, any>;
  if (unexpected(review, ['contractVersion','generationKey','kind','authoredBy','generatedAt','periodStart','periodEnd','latestWorkoutId','headline','journeyHighlight','observations','confidence','limitations','nextStep','contextUsed']).length) errors.push('review contains unsupported fields');
  if (review.contractVersion !== 1) errors.push('contractVersion must be 1');
  if (!text(review.generationKey, 160)) errors.push('generationKey is required');
  if (review.generationKey !== context.generationKey) errors.push('generationKey does not match the request');
  if (!['weekly_review', 'continuity_check_in'].includes(review.kind)) errors.push('kind is invalid');
  if (!text(review.authoredBy, 100)) errors.push('authoredBy is required');
  if (!timestamp(review.generatedAt)) errors.push('generatedAt is invalid');
  const period = context.metrics?.period;
  if (!date(review.periodStart) || review.periodStart !== period?.startDate || !date(review.periodEnd) || review.periodEnd !== period?.endDate) errors.push('review period does not match the request');
  if (review.latestWorkoutId !== context.metrics?.latestWorkoutId) errors.push('latestWorkoutId does not match the request');
  if (!text(review.headline, 180)) errors.push('headline is required');
  if (!record(review.nextStep) || unexpected(review.nextStep, ['title','rationale']).length || !text(review.nextStep.title, 120) || !text(review.nextStep.rationale, 500)) errors.push('nextStep is invalid');
  if (!['low', 'medium', 'high'].includes(review.confidence)) errors.push('confidence is invalid');
  if (!strings(review.limitations, 5) || review.limitations.some((item: unknown) => !text(item, 300))) errors.push('limitations are invalid');
  if (!Array.isArray(review.contextUsed) || review.contextUsed.length < 1 || review.contextUsed.length > 8) errors.push('contextUsed is invalid');
  else {
    for (const item of review.contextUsed) {
      if (!record(item) || unexpected(item, ['source','label','status','startDate','endDate']).length || !['workoutpal','external'].includes(item.source) || !text(item.label, 120) || !['used','stale','unavailable'].includes(item.status) || (item.startDate !== null && !date(item.startDate)) || (item.endDate !== null && !date(item.endDate)) || (date(item.startDate) && date(item.endDate) && item.startDate > item.endDate)) errors.push('a contextUsed source is invalid');
    }
    if (!review.contextUsed.some((item: any) => item?.source === 'workoutpal')) errors.push('contextUsed must include WorkoutPal');
  }
  if (!Array.isArray(review.observations) || review.observations.length > (review.kind === 'weekly_review' ? 4 : 2) || (review.kind === 'weekly_review' && review.observations.length < 1)) errors.push('observations are invalid');
  const evidenceIds = new Set((context.evidenceWorkouts ?? []).map((workout: any) => workout.id));
  const cited: string[] = [];
  if (record(review.journeyHighlight) && strings(review.journeyHighlight.evidenceWorkoutIds, 8)) cited.push(...review.journeyHighlight.evidenceWorkoutIds);
  if (Array.isArray(review.observations)) for (const observation of review.observations) {
    if (!record(observation) || unexpected(observation, ['category','text','evidenceWorkoutIds']).length || !['progress', 'consistency', 'constraint', 'uncertainty'].includes(observation.category) || !text(observation.text, 500) || !strings(observation.evidenceWorkoutIds, 12) || (observation.category !== 'uncertainty' && observation.evidenceWorkoutIds.length < 1)) errors.push('an observation is invalid');
    else cited.push(...observation.evidenceWorkoutIds as string[]);
  }
  if (review.journeyHighlight !== null && (!record(review.journeyHighlight) || unexpected(review.journeyHighlight, ['text','evidenceWorkoutIds']).length || !text(review.journeyHighlight.text, 320) || !strings(review.journeyHighlight.evidenceWorkoutIds, 8))) errors.push('journeyHighlight is invalid');
  if (review.kind === 'weekly_review' && (!record(review.journeyHighlight) || !strings(review.journeyHighlight.evidenceWorkoutIds, 8) || review.journeyHighlight.evidenceWorkoutIds.length < 1)) errors.push('weekly review journeyHighlight is invalid');
  if (review.kind === 'continuity_check_in' && review.journeyHighlight !== null && !record(review.journeyHighlight)) errors.push('continuity journeyHighlight must be an object or null');
  if (new Set(cited).size !== cited.length) errors.push('review contains duplicate evidence IDs');
  if (cited.some((id) => typeof id !== 'string' || !evidenceIds.has(id))) errors.push('review cites evidence outside the supplied context');
  return errors;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!/^wpa_[a-f0-9]{64}$/.test(token)) return response({ error: 'Invalid agent token.' }, 401);
  const url = Deno.env.get('SUPABASE_URL'); const key = serviceKey();
  if (!url || !key) return response({ error: 'Server configuration is unavailable.' }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const tokenHash = await sha256(token);
  const credential = await admin.from('coaching_agent_credentials').select('owner_id').eq('token_hash', tokenHash).is('revoked_at', null).maybeSingle();
  if (credential.error || !credential.data) return response({ error: 'Invalid or revoked agent token.' }, 401);
  const ownerId = credential.data.owner_id;
  await admin.from('coaching_agent_credentials').update({ last_used_at: new Date().toISOString() }).eq('owner_id', ownerId);
  const profile = await admin.from('coaching_profiles').select('payload').eq('owner_id', ownerId).order('effective_at', { ascending: false }).order('revision', { ascending: false }).limit(1).maybeSingle();
  if (profile.error) return response({ error: 'Could not verify coaching consent.' }, 500);
  const consent = profile.data?.payload?.consent;
  if (consent?.coachingEnabled !== true || consent?.shareWorkoutHistory !== true) return response({ error: 'Coaching consent is disabled.' }, 403);

  if (request.method === 'GET') {
    const now = new Date().toISOString();
    let result = await admin.from('coaching_generation_requests').select('*').eq('owner_id', ownerId).eq('status', 'pending').or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`).order('requested_at').limit(1).maybeSingle();
    if (result.error) return response({ error: result.error.message }, 500);
    let expectedStatus = 'pending';
    if (!result.data) {
      const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString();
      result = await admin.from('coaching_generation_requests').select('*').eq('owner_id', ownerId).eq('status', 'processing').lt('updated_at', staleBefore).order('updated_at').limit(1).maybeSingle();
      expectedStatus = 'processing';
    }
    if (!result.data) return response({ request: null });
    const claimed = await admin.from('coaching_generation_requests').update({ status: 'processing', attempts: result.data.attempts + 1, updated_at: now }).eq('id', result.data.id).eq('status', expectedStatus).select('*').maybeSingle();
    if (claimed.error || !claimed.data) return response({ request: null });
    return response({ request: { id: claimed.data.id, generationKey: claimed.data.generation_key, attempt: claimed.data.attempts, context: claimed.data.context } });
  }

  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 100_000) return response({ error: 'Request body is too large.' }, 413);
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return response({ error: 'Body must be JSON.' }, 400); }
  if (!record(body) || JSON.stringify(body).length > 100_000) return response({ error: 'Request body is too large.' }, 413);
  if (!text(body.generationKey, 160)) return response({ error: 'generationKey is required.' }, 400);
  const allowedEnvelope = body.action === 'publish' ? ['action','generationKey','review','proposal'] : ['action','generationKey','retryable','error'];
  if (unexpected(body, allowedEnvelope).length) return response({ error: 'Request contains unsupported fields.' }, 400);
  const requestRow = await admin.from('coaching_generation_requests').select('*').eq('owner_id', ownerId).eq('generation_key', body.generationKey).maybeSingle();
  if (requestRow.error || !requestRow.data) return response({ error: 'Generation request not found.' }, 404);
  if (body.action === 'fail') {
    const retryable = body.retryable !== false && requestRow.data.attempts < 5;
    const delaySeconds = Math.min(21_600, 60 * 2 ** Math.max(0, requestRow.data.attempts - 1));
    const update = { status: retryable ? 'pending' : 'failed', next_attempt_at: retryable ? new Date(Date.now() + delaySeconds * 1000).toISOString() : null, last_error: String(body.error || 'Agent generation failed.').slice(0, 500), updated_at: new Date().toISOString() };
    const failed = await admin.from('coaching_generation_requests').update(update).eq('id', requestRow.data.id);
    return failed.error ? response({ error: failed.error.message }, 500) : response({ status: update.status, nextAttemptAt: update.next_attempt_at });
  }
  if (body.action !== 'publish') return response({ error: 'action must be publish or fail.' }, 400);
  const validationErrors = validateDraft(body.review, requestRow.data.context);
  if (validationErrors.length) return response({ error: 'Review validation failed.', details: validationErrors }, 422);
  const existing = await admin.from('coach_reviews').select('id').eq('owner_id', ownerId).eq('generation_key', body.generationKey).maybeSingle();
  if (existing.data) {
    await admin.from('coaching_generation_requests').update({ status: 'ready', review_id: existing.data.id, last_error: null, next_attempt_at: null, updated_at: new Date().toISOString() }).eq('id', requestRow.data.id);
    if (body.proposal !== undefined) {
      const proposalResult = await admin.rpc('publish_coach_routine_proposal_v1', { p_request_id: requestRow.data.id, p_proposal: body.proposal });
      if (proposalResult.error) return response({ error: 'Routine proposal validation failed.', details: proposalResult.error.message, reviewId: existing.data.id }, 422);
      return response({ status: 'ready', reviewId: existing.data.id, proposalId: proposalResult.data, duplicate: true });
    }
    return response({ status: 'ready', reviewId: existing.data.id, duplicate: true });
  }
  const id = crypto.randomUUID(); const publishedAt = new Date().toISOString();
  const record = { storageVersion: 1, id, revision: 1, profileId: requestRow.data.profile_id, profileRevision: requestRow.data.profile_revision, contextVersion: requestRow.data.context_version, generationKey: body.generationKey, publishedAt, review: body.review };
  const insert = await admin.from('coach_reviews').insert({ id, owner_id: ownerId, generation_key: body.generationKey, storage_version: 1, contract_version: 1, profile_id: requestRow.data.profile_id, profile_revision: requestRow.data.profile_revision, context_version: requestRow.data.context_version, period_start: body.review.periodStart, period_end: body.review.periodEnd, latest_workout_id: body.review.latestWorkoutId, payload: record, published_at: publishedAt });
  if (insert.error) return response({ error: insert.error.message }, 422);
  const ready = await admin.from('coaching_generation_requests').update({ status: 'ready', review_id: id, last_error: null, next_attempt_at: null, updated_at: publishedAt }).eq('id', requestRow.data.id);
  if (ready.error) return response({ error: ready.error.message }, 500);
  if (body.proposal !== undefined) {
    const proposalResult = await admin.rpc('publish_coach_routine_proposal_v1', { p_request_id: requestRow.data.id, p_proposal: body.proposal });
    if (proposalResult.error) return response({ error: 'Routine proposal validation failed.', details: proposalResult.error.message, reviewId: id }, 422);
    return response({ status: 'ready', reviewId: id, proposalId: proposalResult.data, duplicate: false });
  }
  return response({ status: 'ready', reviewId: id, duplicate: false });
});
