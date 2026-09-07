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
