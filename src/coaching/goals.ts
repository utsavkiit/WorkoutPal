import { WeightUnit } from '../types';

export const COACHING_PROFILE_VERSION = 1 as const;

export type TrainingGoalStatus = 'active' | 'paused' | 'achieved' | 'archived';

export type TrainingGoalFocus =
  | { type: 'general_strength' }
  | { type: 'specific_lift_strength'; exerciseId: string; target: { weight: number; reps: number; unit: WeightUnit } | null }
  | { type: 'hypertrophy'; muscleGroups: string[] }
  | { type: 'consistency'; sessionsPerWeek: number }
  | { type: 'maintenance'; exerciseIds: string[] };

export interface TrainingGoalV1 {
  id: string;
  status: TrainingGoalStatus;
  priority: 1 | 2 | 3;
  focus: TrainingGoalFocus;
  motivation: string | null;
  targetDate: string | null;
}

export interface CoachingProfileV1 {
  schemaVersion: typeof COACHING_PROFILE_VERSION;
  id: string;
  revision: number;
  effectiveAt: string;
  updatedAt: string;
  goals: TrainingGoalV1[];
  constraints: {
    availableDaysPerWeek: number;
    sessionMinutes: number;
    equipment: string[];
    considerations: string | null;
  };
  preferences: {
    preferredExerciseIds: string[];
    avoidedExerciseIds: string[];
  };
  consent: {
    coachingEnabled: boolean;
    shareWorkoutHistory: boolean;
    includeCheckIns: boolean;
    consentedAt: string | null;
    revokedAt: string | null;
  };
  weeklyReview: {
    enabled: boolean;
    dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    timezone: string;
    notificationEnabled: boolean;
  };
}

export type CoachingProfileValidationResult =
  | { ok: true; value: CoachingProfileV1 }
  | { ok: false; errors: string[] };

const goalStatuses: TrainingGoalStatus[] = ['active', 'paused', 'achieved', 'archived'];
const goalTypes: TrainingGoalFocus['type'][] = ['general_strength', 'specific_lift_strength', 'hypertrophy', 'consistency', 'maintenance'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function requiredText(value: unknown, path: string, maximum: number, errors: string[]): value is string {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${path} is required.`);
    return false;
  }
  if (value.trim().length > maximum) errors.push(`${path} must be ${maximum} characters or fewer.`);
  return true;
}

function optionalText(value: unknown, path: string, maximum: number, errors: string[]) {
  if (value === null) return;
  requiredText(value, path, maximum, errors);
}

function uniqueStringArray(value: unknown, path: string, maximum: number, errors: string[]): value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    errors.push(`${path} must contain only non-empty strings.`);
    return false;
  }
  if (value.length > maximum) errors.push(`${path} must contain at most ${maximum} items.`);
  if (new Set(value).size !== value.length) errors.push(`${path} must not contain duplicate values.`);
  return true;
}

function validateFocus(value: unknown, path: string, errors: string[]) {
  if (!isRecord(value) || !goalTypes.includes(value.type as TrainingGoalFocus['type'])) {
    errors.push(`${path}.type is invalid.`);
    return;
  }
  if (value.type === 'specific_lift_strength') {
    requiredText(value.exerciseId, `${path}.exerciseId`, 80, errors);
    if (value.target !== null) {
      if (!isRecord(value.target)) {
        errors.push(`${path}.target must be an object or null.`);
      } else {
        if (typeof value.target.weight !== 'number' || !Number.isFinite(value.target.weight) || value.target.weight <= 0) errors.push(`${path}.target.weight must be positive.`);
        if (!Number.isInteger(value.target.reps) || (value.target.reps as number) < 1 || (value.target.reps as number) > 100) errors.push(`${path}.target.reps must be an integer from 1 to 100.`);
        if (value.target.unit !== 'lb' && value.target.unit !== 'kg') errors.push(`${path}.target.unit is invalid.`);
      }
    }
  } else if (value.type === 'hypertrophy') {
    if (uniqueStringArray(value.muscleGroups, `${path}.muscleGroups`, 8, errors) && value.muscleGroups.length === 0) errors.push(`${path}.muscleGroups must contain at least one item.`);
  } else if (value.type === 'consistency') {
    if (!Number.isInteger(value.sessionsPerWeek) || (value.sessionsPerWeek as number) < 1 || (value.sessionsPerWeek as number) > 7) errors.push(`${path}.sessionsPerWeek must be an integer from 1 to 7.`);
  } else if (value.type === 'maintenance') {
    if (uniqueStringArray(value.exerciseIds, `${path}.exerciseIds`, 12, errors) && value.exerciseIds.length === 0) errors.push(`${path}.exerciseIds must contain at least one item.`);
  }
}

export function validateCoachingProfile(input: unknown): CoachingProfileValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ['Coaching profile must be an object.'] };

  if (input.schemaVersion !== COACHING_PROFILE_VERSION) errors.push(`schemaVersion must be ${COACHING_PROFILE_VERSION}.`);
  requiredText(input.id, 'id', 80, errors);
  if (!Number.isInteger(input.revision) || (input.revision as number) < 1) errors.push('revision must be a positive integer.');
  if (!isIsoTimestamp(input.effectiveAt)) errors.push('effectiveAt must be an ISO timestamp.');
  if (!isIsoTimestamp(input.updatedAt)) errors.push('updatedAt must be an ISO timestamp.');
  if (isIsoTimestamp(input.effectiveAt) && isIsoTimestamp(input.updatedAt) && input.updatedAt < input.effectiveAt) errors.push('updatedAt must not be before effectiveAt.');

  if (!Array.isArray(input.goals) || input.goals.length === 0 || input.goals.length > 3) {
    errors.push('goals must contain between 1 and 3 items.');
  } else {
    const ids = new Set<string>();
    const activePriorities = new Set<number>();
    let activeGoalCount = 0;
    let activePrimaryCount = 0;
    input.goals.forEach((goal, index) => {
      const path = `goals[${index}]`;
      if (!isRecord(goal)) {
        errors.push(`${path} must be an object.`);
        return;
      }
      if (requiredText(goal.id, `${path}.id`, 80, errors)) {
        if (ids.has(goal.id)) errors.push(`${path}.id must be unique.`);
        ids.add(goal.id);
      }
      if (!goalStatuses.includes(goal.status as TrainingGoalStatus)) errors.push(`${path}.status is invalid.`);
      if (![1, 2, 3].includes(goal.priority as number)) errors.push(`${path}.priority must be 1, 2, or 3.`);
      if (goal.status === 'active' && typeof goal.priority === 'number') {
        activeGoalCount += 1;
        if (activePriorities.has(goal.priority)) errors.push('Active goal priorities must be unique.');
        activePriorities.add(goal.priority);
        if (goal.priority === 1) activePrimaryCount += 1;
      }
      validateFocus(goal.focus, `${path}.focus`, errors);
      optionalText(goal.motivation, `${path}.motivation`, 300, errors);
      if (goal.targetDate !== null && !isDateOnly(goal.targetDate)) errors.push(`${path}.targetDate must be a YYYY-MM-DD date or null.`);
    });
    if (activeGoalCount > 0 && activePrimaryCount !== 1) errors.push('An active goal set must contain exactly one priority-1 goal.');
  }

  if (!isRecord(input.constraints)) {
    errors.push('constraints must be an object.');
  } else {
    if (!Number.isInteger(input.constraints.availableDaysPerWeek) || (input.constraints.availableDaysPerWeek as number) < 1 || (input.constraints.availableDaysPerWeek as number) > 7) errors.push('constraints.availableDaysPerWeek must be an integer from 1 to 7.');
    if (!Number.isInteger(input.constraints.sessionMinutes) || (input.constraints.sessionMinutes as number) < 15 || (input.constraints.sessionMinutes as number) > 240) errors.push('constraints.sessionMinutes must be an integer from 15 to 240.');
    uniqueStringArray(input.constraints.equipment, 'constraints.equipment', 30, errors);
    optionalText(input.constraints.considerations, 'constraints.considerations', 500, errors);
  }

  if (!isRecord(input.preferences)) {
    errors.push('preferences must be an object.');
  } else {
    const preferredExerciseIds = input.preferences.preferredExerciseIds;
    const avoidedExerciseIds = input.preferences.avoidedExerciseIds;
    const preferredValid = uniqueStringArray(preferredExerciseIds, 'preferences.preferredExerciseIds', 30, errors);
    const avoidedValid = uniqueStringArray(avoidedExerciseIds, 'preferences.avoidedExerciseIds', 30, errors);
    if (preferredValid && avoidedValid) {
      const avoided = new Set(avoidedExerciseIds);
      if (preferredExerciseIds.some((id) => avoided.has(id))) errors.push('An exercise cannot be both preferred and avoided.');
    }
  }

  if (!isRecord(input.consent)) {
    errors.push('consent must be an object.');
  } else {
    for (const key of ['coachingEnabled', 'shareWorkoutHistory', 'includeCheckIns'] as const) {
      if (typeof input.consent[key] !== 'boolean') errors.push(`consent.${key} must be boolean.`);
    }
    if (input.consent.consentedAt !== null && !isIsoTimestamp(input.consent.consentedAt)) errors.push('consent.consentedAt must be an ISO timestamp or null.');
    if (input.consent.revokedAt !== null && !isIsoTimestamp(input.consent.revokedAt)) errors.push('consent.revokedAt must be an ISO timestamp or null.');
    if (input.consent.coachingEnabled) {
      if (!input.consent.shareWorkoutHistory) errors.push('Enabled coaching requires workout-history consent.');
      if (!isIsoTimestamp(input.consent.consentedAt)) errors.push('Enabled coaching requires consentedAt.');
      if (input.consent.revokedAt !== null) errors.push('Enabled coaching cannot have revokedAt.');
    }
  }

  if (!isRecord(input.weeklyReview)) {
    errors.push('weeklyReview must be an object.');
  } else {
    if (typeof input.weeklyReview.enabled !== 'boolean') errors.push('weeklyReview.enabled must be boolean.');
    if (!Number.isInteger(input.weeklyReview.dayOfWeek) || (input.weeklyReview.dayOfWeek as number) < 0 || (input.weeklyReview.dayOfWeek as number) > 6) errors.push('weeklyReview.dayOfWeek must be an integer from 0 to 6.');
    if (!validTimezone(input.weeklyReview.timezone)) errors.push('weeklyReview.timezone must be a valid IANA timezone.');
    if (typeof input.weeklyReview.notificationEnabled !== 'boolean') errors.push('weeklyReview.notificationEnabled must be boolean.');
    if (input.weeklyReview.enabled && (!isRecord(input.consent) || input.consent.coachingEnabled !== true)) errors.push('Weekly reviews require coaching consent.');
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: input as unknown as CoachingProfileV1 };
}
