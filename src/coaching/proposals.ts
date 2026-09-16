import { CoachingContextV1 } from './context';

export const COACH_ROUTINE_PROPOSAL_VERSION = 1 as const;
export type CoachRoutineProposalStatus = 'pending' | 'accepted' | 'dismissed';

export interface CoachRoutineProposalDraftV1 {
  proposalVersion: typeof COACH_ROUTINE_PROPOSAL_VERSION;
  name: string;
  summary: string;
  exercises: { exerciseId: string; setCount: number; rationale: string }[];
  removed: { exerciseId: string; rationale: string }[];
  limitations: string[];
}

export interface CoachRoutineSourceV1 {
  id: string;
  name: string;
  version: string;
  exercises: { exerciseId: string; name: string; sortOrder: number; setCount: number }[];
}

export interface StoredCoachRoutineProposalV1 {
  storageVersion: typeof COACH_ROUTINE_PROPOSAL_VERSION;
  id: string;
  reviewId: string;
  generationKey: string;
  publishedAt: string;
  sourceRoutine: CoachRoutineSourceV1 | null;
  proposal: CoachRoutineProposalDraftV1;
}

export interface CoachRoutineProposalItem {
  record: StoredCoachRoutineProposalV1;
  status: CoachRoutineProposalStatus;
  appliedRoutineId: string | null;
  decidedAt: string | null;
}

type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isTime = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
const text = (value: unknown, max: number) => typeof value === 'string' && !!value.trim() && value.trim().length <= max;
const keysAre = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).length === allowed.length && Object.keys(value).every((key) => allowed.includes(key));

function validateSource(input: unknown, errors: string[]): CoachRoutineSourceV1 | null {
  if (input === null) return null;
  if (!isObject(input) || !keysAre(input, ['id', 'name', 'version', 'exercises'])) {
    errors.push('sourceRoutine must be an exact routine snapshot or null.'); return null;
  }
  if (!isUuid(input.id) || !text(input.name, 100) || !isTime(input.version)) errors.push('sourceRoutine identity, name, or version is invalid.');
  if (!Array.isArray(input.exercises) || input.exercises.length > 20 || !input.exercises.every((item, index) =>
    isObject(item) && keysAre(item, ['exerciseId', 'name', 'sortOrder', 'setCount']) && isUuid(item.exerciseId)
    && text(item.name, 100) && item.sortOrder === index && Number.isInteger(item.setCount) && (item.setCount as number) >= 1 && (item.setCount as number) <= 10
  )) errors.push('sourceRoutine exercises are invalid.');
  if (Array.isArray(input.exercises) && new Set(input.exercises.map((item) => item?.exerciseId)).size !== input.exercises.length) errors.push('sourceRoutine exercises must be unique.');
  return input as unknown as CoachRoutineSourceV1;
}

export function validateCoachRoutineProposalDraft(input: unknown, source: CoachRoutineSourceV1 | null): Validation<CoachRoutineProposalDraftV1> {
  const errors: string[] = [];
  if (!isObject(input) || !keysAre(input, ['proposalVersion', 'name', 'summary', 'exercises', 'removed', 'limitations'])) return { ok: false, errors: ['Proposal must contain exactly the supported v1 fields.'] };
  if (input.proposalVersion !== 1) errors.push('proposalVersion must be 1.');
  if (!text(input.name, 100)) errors.push('name must be 1–100 characters.');
  if (!text(input.summary, 500)) errors.push('summary must be 1–500 characters.');
  if (!Array.isArray(input.exercises) || input.exercises.length < 1 || input.exercises.length > 12 || !input.exercises.every((item) =>
    isObject(item) && keysAre(item, ['exerciseId', 'setCount', 'rationale']) && isUuid(item.exerciseId)
    && Number.isInteger(item.setCount) && (item.setCount as number) >= 1 && (item.setCount as number) <= 6 && text(item.rationale, 300)
  )) errors.push('exercises must contain 1–12 known exercise IDs, 1–6 sets, and a rationale each.');
  if (!Array.isArray(input.removed) || input.removed.length > 20 || !input.removed.every((item) =>
    isObject(item) && keysAre(item, ['exerciseId', 'rationale']) && isUuid(item.exerciseId) && text(item.rationale, 300)
  )) errors.push('removed exercises must have IDs and rationales.');
  if (!Array.isArray(input.limitations) || input.limitations.length > 4 || !input.limitations.every((item) => text(item, 300))) errors.push('limitations must contain at most four short statements.');
  if (Array.isArray(input.exercises) && new Set(input.exercises.map((item) => item?.exerciseId)).size !== input.exercises.length) errors.push('Proposed exercises must be unique.');
  if (Array.isArray(input.removed) && new Set(input.removed.map((item) => item?.exerciseId)).size !== input.removed.length) errors.push('Removed exercises must be unique.');
  if (Array.isArray(input.exercises) && input.exercises.every((item) => Number.isInteger(item?.setCount))) {
    const proposedSets = input.exercises.reduce((sum, item) => sum + item.setCount, 0);
    if (proposedSets > 36) errors.push('The proposal exceeds the conservative 36-set cap.');
    if (source && proposedSets > source.exercises.reduce((sum, item) => sum + item.setCount, 0) + 6) errors.push('The proposal adds more than six sets to the source routine.');
  }
  if (Array.isArray(input.exercises) && Array.isArray(input.removed)) {
    const proposedIds = new Set(input.exercises.map((item) => item?.exerciseId));
    const expectedRemoved = (source?.exercises ?? []).map((item) => item.exerciseId).filter((id) => !proposedIds.has(id));
    const actualRemoved = input.removed.map((item) => item?.exerciseId);
    if (expectedRemoved.length !== actualRemoved.length || expectedRemoved.some((id) => !actualRemoved.includes(id))) errors.push('Every removed source exercise needs one rationale; unchanged exercises cannot be marked removed.');
    if (source && input.name === source.name && input.exercises.length === source.exercises.length && input.exercises.every((item, index) => item.exerciseId === source.exercises[index].exerciseId && item.setCount === source.exercises[index].setCount)) errors.push('A proposal must change the routine.');
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: input as unknown as CoachRoutineProposalDraftV1 };
}

export function validateStoredCoachRoutineProposal(input: unknown): Validation<StoredCoachRoutineProposalV1> {
  const errors: string[] = [];
  if (!isObject(input) || !keysAre(input, ['storageVersion', 'id', 'reviewId', 'generationKey', 'publishedAt', 'sourceRoutine', 'proposal'])) return { ok: false, errors: ['Stored proposal has unsupported or missing fields.'] };
  if (input.storageVersion !== 1) errors.push('storageVersion must be 1.');
  if (!isUuid(input.id) || !isUuid(input.reviewId)) errors.push('Proposal and review IDs must be UUIDs.');
  if (!text(input.generationKey, 160)) errors.push('generationKey is invalid.');
  if (!isTime(input.publishedAt)) errors.push('publishedAt must be an ISO timestamp.');
  const source = validateSource(input.sourceRoutine, errors);
  const draft = validateCoachRoutineProposalDraft(input.proposal, source);
  if (!draft.ok) errors.push(...draft.errors);
  return errors.length ? { ok: false, errors } : { ok: true, value: input as unknown as StoredCoachRoutineProposalV1 };
}

export function createStoredCoachRoutineProposal(context: CoachingContextV1, reviewId: string, id: string, draft: CoachRoutineProposalDraftV1, publishedAt = new Date().toISOString()): StoredCoachRoutineProposalV1 {
  const allowed = new Set([
    ...(context.exerciseCatalog ?? []).map((item) => item.id),
    ...(context.currentRoutine?.exercises ?? []).map((item) => item.exerciseId),
    ...context.evidenceWorkouts.flatMap((workout) => workout.exercises.map((item) => item.exerciseId)),
  ]);
  const source = context.currentRoutine ?? null;
  const validation = validateCoachRoutineProposalDraft(draft, source);
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  if (draft.exercises.some((item) => !allowed.has(item.exerciseId))) throw new Error('Proposal uses an exercise outside the supplied coaching context.');
  const record: StoredCoachRoutineProposalV1 = { storageVersion: 1, id, reviewId, generationKey: context.generationKey, publishedAt, sourceRoutine: source, proposal: validation.value };
  const stored = validateStoredCoachRoutineProposal(record);
  if (!stored.ok) throw new Error(stored.errors.join(' '));
  return stored.value;
}

export function sourceRoutineStillMatches(source: CoachRoutineSourceV1 | null, current: { id: string; name: string; updatedAt: string; archived: boolean; exercises: { exerciseId: string; sortOrder: number; setCount: number }[] } | null) {
  if (!source) return current === null;
  return !!current && !current.archived && current.id === source.id && current.name === source.name && Date.parse(current.updatedAt) === Date.parse(source.version)
    && current.exercises.length === source.exercises.length && current.exercises.every((item, index) => item.exerciseId === source.exercises[index].exerciseId && item.sortOrder === source.exercises[index].sortOrder && item.setCount === source.exercises[index].setCount);
}
