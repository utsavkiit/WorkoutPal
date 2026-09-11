import { ExerciseType, WeightUnit } from './types';

export function canCompleteSet(type: ExerciseType, weight: number | null, reps: number | null) {
  return Boolean(reps && reps > 0 && (type === 'bodyweight' || weight !== null));
}

export function moveItem<T>(items: readonly T[], from: number, direction: -1 | 1) {
  const to = from + direction;
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function previousLabel(value: { weight: number | null; reps: number | null; unit: WeightUnit } | null | undefined) {
  if (!value) return '—';
  return `${value.weight === null ? 'BW' : `${value.weight} ${value.unit}`} × ${value.reps ?? '–'}`;
}

export type ValidationResult<T> = { ok: true } & T | { ok: false; error: string };

export function validateHistoryName(name: string): ValidationResult<{ name: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Name is required.' };
  if (trimmed.length > 60) return { ok: false, error: 'Name must be 60 characters or fewer.' };
  return { ok: true, name: trimmed };
}

// Replaces the year/month/day of `referenceIso` while preserving its time-of-day, rejecting
// calendar rollovers (e.g. Feb 31) and dates after `nowIso`.
export function validateHistoryDate(referenceIso: string, year: number, month: number, day: number, nowIso: string): ValidationResult<{ date: Date }> {
  if (![year, month, day].every(Number.isInteger)) return { ok: false, error: 'Enter a valid date.' };
  const candidate = new Date(referenceIso);
  candidate.setFullYear(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return { ok: false, error: 'Enter a valid date.' };
  if (candidate.getTime() > new Date(nowIso).getTime()) return { ok: false, error: 'Date cannot be in the future.' };
  return { ok: true, date: candidate };
}

// Shifts startedAt by the same delta applied to endedAt, so a corrected date preserves duration.
export function shiftWorkoutDates(startedAt: string, endedAt: string, correctedEndedAt: Date) {
  const delta = correctedEndedAt.getTime() - new Date(endedAt).getTime();
  return { startedAt: new Date(new Date(startedAt).getTime() + delta).toISOString(), endedAt: correctedEndedAt.toISOString() };
}
