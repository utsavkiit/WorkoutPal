export const COACHING_CONTRACT_VERSION = 1 as const;

export type CoachReviewKind = 'weekly_review' | 'continuity_check_in';
export type CoachConfidence = 'low' | 'medium' | 'high';
export type CoachObservationCategory = 'progress' | 'consistency' | 'constraint' | 'uncertainty';
export type CoachContextStatus = 'used' | 'stale' | 'unavailable';
export type CoachContextSource = 'workoutpal' | 'external';

export interface CoachObservationDraft {
  category: CoachObservationCategory;
  text: string;
  evidenceWorkoutIds: string[];
}

export interface CoachContextSourceDraft {
  source: CoachContextSource;
  label: string;
  status: CoachContextStatus;
  startDate: string | null;
  endDate: string | null;
}

export interface CoachReviewDraftV1 {
  contractVersion: typeof COACHING_CONTRACT_VERSION;
  generationKey: string;
  kind: CoachReviewKind;
  authoredBy: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  latestWorkoutId: string | null;
  headline: string;
  journeyHighlight: {
    text: string;
    evidenceWorkoutIds: string[];
  } | null;
  observations: CoachObservationDraft[];
  confidence: CoachConfidence;
  limitations: string[];
  nextStep: {
    title: string;
    rationale: string;
  };
  contextUsed: CoachContextSourceDraft[];
}

export interface ExpectedCoachReviewContext {
  generationKey: string;
  periodStart: string;
  periodEnd: string;
  latestWorkoutId: string | null;
}

export type CoachReviewValidationResult =
  | { ok: true; value: CoachReviewDraftV1 }
  | { ok: false; errors: string[] };

const reviewKinds: CoachReviewKind[] = ['weekly_review', 'continuity_check_in'];
const confidenceValues: CoachConfidence[] = ['low', 'medium', 'high'];
const observationCategories: CoachObservationCategory[] = ['progress', 'consistency', 'constraint', 'uncertainty'];
const contextStatuses: CoachContextStatus[] = ['used', 'stale', 'unavailable'];
const contextSources: CoachContextSource[] = ['workoutpal', 'external'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnexpectedKeys(value: Record<string, unknown>, path: string, allowed: readonly string[], errors: string[]) {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) errors.push(`${path}.${key} is not supported by contract v${COACHING_CONTRACT_VERSION}.`);
  }
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function requiredText(value: unknown, path: string, maxLength: number, errors: string[]): value is string {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${path} is required.`);
    return false;
  }
  if (value.trim().length > maxLength) {
    errors.push(`${path} must be ${maxLength} characters or fewer.`);
    return false;
  }
  return true;
}

function stringArray(value: unknown, path: string, maximum: number, errors: string[]): value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    errors.push(`${path} must contain only non-empty strings.`);
    return false;
  }
  if (value.length > maximum) errors.push(`${path} must contain at most ${maximum} items.`);
  if (new Set(value).size !== value.length) errors.push(`${path} must not contain duplicate values.`);
  return true;
}

export function validateCoachReviewDraft(
  input: unknown,
  expected?: ExpectedCoachReviewContext,
): CoachReviewValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ['Review must be an object.'] };
  rejectUnexpectedKeys(input, 'review', [
    'contractVersion', 'generationKey', 'kind', 'authoredBy', 'generatedAt', 'periodStart',
    'periodEnd', 'latestWorkoutId', 'headline', 'journeyHighlight', 'observations',
    'confidence', 'limitations', 'nextStep', 'contextUsed',
  ], errors);

  if (input.contractVersion !== COACHING_CONTRACT_VERSION) errors.push(`contractVersion must be ${COACHING_CONTRACT_VERSION}.`);
  requiredText(input.generationKey, 'generationKey', 160, errors);
  if (!reviewKinds.includes(input.kind as CoachReviewKind)) errors.push('kind is invalid.');
  requiredText(input.authoredBy, 'authoredBy', 100, errors);
  if (!isIsoTimestamp(input.generatedAt)) errors.push('generatedAt must be an ISO timestamp.');
  if (!isDateOnly(input.periodStart)) errors.push('periodStart must be a valid YYYY-MM-DD date.');
  if (!isDateOnly(input.periodEnd)) errors.push('periodEnd must be a valid YYYY-MM-DD date.');
  if (isDateOnly(input.periodStart) && isDateOnly(input.periodEnd) && input.periodStart > input.periodEnd) errors.push('periodStart must not be after periodEnd.');
  if (input.latestWorkoutId !== null && (typeof input.latestWorkoutId !== 'string' || !input.latestWorkoutId.trim())) errors.push('latestWorkoutId must be a non-empty string or null.');
  requiredText(input.headline, 'headline', 180, errors);

  const kind = input.kind as CoachReviewKind;
  if (input.journeyHighlight === null) {
    if (kind === 'weekly_review') errors.push('journeyHighlight is required for a weekly review.');
  } else if (!isRecord(input.journeyHighlight)) {
    errors.push('journeyHighlight must be an object or null.');
  } else {
    rejectUnexpectedKeys(input.journeyHighlight, 'journeyHighlight', ['text', 'evidenceWorkoutIds'], errors);
    requiredText(input.journeyHighlight.text, 'journeyHighlight.text', 320, errors);
    if (stringArray(input.journeyHighlight.evidenceWorkoutIds, 'journeyHighlight.evidenceWorkoutIds', 8, errors)
      && input.journeyHighlight.evidenceWorkoutIds.length === 0) {
      errors.push('journeyHighlight must cite at least one workout.');
    }
  }

  if (!Array.isArray(input.observations)) {
    errors.push('observations must be an array.');
  } else {
    const maximum = kind === 'continuity_check_in' ? 2 : 4;
    if (input.observations.length > maximum) errors.push(`observations must contain at most ${maximum} items.`);
    if (kind === 'weekly_review' && input.observations.length === 0) errors.push('weekly reviews require at least one observation.');
    input.observations.forEach((value, index) => {
      const path = `observations[${index}]`;
      if (!isRecord(value)) {
        errors.push(`${path} must be an object.`);
        return;
      }
      rejectUnexpectedKeys(value, path, ['category', 'text', 'evidenceWorkoutIds'], errors);
      if (!observationCategories.includes(value.category as CoachObservationCategory)) errors.push(`${path}.category is invalid.`);
      requiredText(value.text, `${path}.text`, 500, errors);
      if (stringArray(value.evidenceWorkoutIds, `${path}.evidenceWorkoutIds`, 12, errors)
        && value.category !== 'uncertainty'
        && value.evidenceWorkoutIds.length === 0) {
        errors.push(`${path} must cite at least one workout unless it describes uncertainty.`);
      }
    });
  }

  if (!confidenceValues.includes(input.confidence as CoachConfidence)) errors.push('confidence is invalid.');
  if (stringArray(input.limitations, 'limitations', 5, errors)) {
    input.limitations.forEach((value, index) => requiredText(value, `limitations[${index}]`, 300, errors));
  }

  if (!isRecord(input.nextStep)) {
    errors.push('nextStep must be an object.');
  } else {
    rejectUnexpectedKeys(input.nextStep, 'nextStep', ['title', 'rationale'], errors);
    requiredText(input.nextStep.title, 'nextStep.title', 120, errors);
    requiredText(input.nextStep.rationale, 'nextStep.rationale', 500, errors);
  }

  if (!Array.isArray(input.contextUsed) || input.contextUsed.length === 0) {
    errors.push('contextUsed must contain at least one source.');
  } else {
    if (input.contextUsed.length > 8) errors.push('contextUsed must contain at most 8 sources.');
    input.contextUsed.forEach((value, index) => {
      const path = `contextUsed[${index}]`;
      if (!isRecord(value)) {
        errors.push(`${path} must be an object.`);
        return;
      }
      rejectUnexpectedKeys(value, path, ['source', 'label', 'status', 'startDate', 'endDate'], errors);
      if (!contextSources.includes(value.source as CoachContextSource)) errors.push(`${path}.source is invalid.`);
      requiredText(value.label, `${path}.label`, 120, errors);
      if (!contextStatuses.includes(value.status as CoachContextStatus)) errors.push(`${path}.status is invalid.`);
      if (value.startDate !== null && !isDateOnly(value.startDate)) errors.push(`${path}.startDate must be a YYYY-MM-DD date or null.`);
      if (value.endDate !== null && !isDateOnly(value.endDate)) errors.push(`${path}.endDate must be a YYYY-MM-DD date or null.`);
      if (isDateOnly(value.startDate) && isDateOnly(value.endDate) && value.startDate > value.endDate) errors.push(`${path}.startDate must not be after endDate.`);
    });
    if (!input.contextUsed.some((value) => isRecord(value) && value.source === 'workoutpal')) errors.push('contextUsed must include WorkoutPal as the baseline source.');
  }

  if (expected) {
    if (input.generationKey !== expected.generationKey) errors.push('generationKey does not match the requested review.');
    if (input.periodStart !== expected.periodStart || input.periodEnd !== expected.periodEnd) errors.push('Review period does not match the requested review.');
    if (input.latestWorkoutId !== expected.latestWorkoutId) errors.push('latestWorkoutId does not match the coaching context.');
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: input as unknown as CoachReviewDraftV1 };
}
