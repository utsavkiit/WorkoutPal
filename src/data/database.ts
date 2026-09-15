import * as SQLite from 'expo-sqlite';
import { SEEDED_EXERCISES } from './exercises';
import { Exercise, ExerciseType, Routine, RoutineExercise, UserPreferences, WeightUnit, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { canCompleteSet } from '../domain';
import { now } from '../utils';
import { makeId } from './id';
import { CoachingCheckInV1, CoachingProfileV1, validateCoachingCheckIn, validateCoachingProfile } from '../coaching/goals';
import { WeeklyCoachingMetricsV1, calculateWeeklyCoachingMetrics } from '../coaching/metrics';
import { CoachingContextV1, buildCoachingContext } from '../coaching/context';
import { classifyRemoteCoachReviews, StoredCoachReviewV1, validateStoredCoachReview } from '../coaching/reviews';
import { CoachingGenerationRequestV1, validateGenerationRequest } from '../coaching/workflow';
import { CoachReviewFeedbackV1, validateCoachReviewFeedback } from '../coaching/feedback';
import { WeeklyScheduleDecision, weeklyScheduleDecision } from '../coaching/scheduling';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initializePromise: Promise<void> | null = null;

const database = () => {
  dbPromise ??= SQLite.openDatabaseAsync('workoutpal.db');
  return dbPromise;
};

const schema = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY, owner_id TEXT, name TEXT NOT NULL, muscle_group TEXT NOT NULL,
  equipment TEXT NOT NULL, type TEXT NOT NULL, is_custom INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY, owner_id TEXT, name TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS routine_exercises (
  id TEXT PRIMARY KEY, routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id), sort_order INTEGER NOT NULL,
  set_count INTEGER NOT NULL DEFAULT 3, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workout_sessions (
  id TEXT PRIMARY KEY, owner_id TEXT, routine_id TEXT, name TEXT NOT NULL, status TEXT NOT NULL,
  started_at TEXT NOT NULL, ended_at TEXT, updated_at TEXT NOT NULL, synced_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_workout ON workout_sessions(status) WHERE status = 'active';
CREATE TABLE IF NOT EXISTS workout_exercises (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL, exercise_name TEXT NOT NULL, exercise_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workout_sets (
  id TEXT PRIMARY KEY, workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL, weight REAL, reps INTEGER, unit TEXT NOT NULL,
  completed_at TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS preferences (
  id TEXT PRIMARY KEY CHECK(id = 'local'), unit TEXT NOT NULL, rest_seconds INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY, entity TEXT NOT NULL, entity_id TEXT NOT NULL, operation TEXT NOT NULL,
  payload TEXT NOT NULL, created_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT
);
CREATE TABLE IF NOT EXISTS coaching_profiles (
  revision_id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision > 0),
  owner_id TEXT, payload TEXT NOT NULL, effective_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(profile_id, revision)
);
CREATE TABLE IF NOT EXISTS coaching_check_ins (
  id TEXT PRIMARY KEY, owner_id TEXT, profile_id TEXT NOT NULL, profile_revision INTEGER NOT NULL,
  payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(profile_id, profile_revision) REFERENCES coaching_profiles(profile_id, revision)
);
CREATE TABLE IF NOT EXISTS coach_reviews (
  id TEXT PRIMARY KEY, owner_id TEXT, generation_key TEXT NOT NULL UNIQUE, payload TEXT NOT NULL,
  profile_id TEXT NOT NULL, profile_revision INTEGER NOT NULL, context_version INTEGER NOT NULL,
  period_start TEXT NOT NULL, period_end TEXT NOT NULL, latest_workout_id TEXT,
  published_at TEXT NOT NULL, archived_at TEXT,
  FOREIGN KEY(profile_id, profile_revision) REFERENCES coaching_profiles(profile_id, revision)
);
CREATE TABLE IF NOT EXISTS coaching_generation_requests (
  id TEXT PRIMARY KEY, owner_id TEXT, generation_key TEXT NOT NULL UNIQUE, context TEXT NOT NULL,
  status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT, last_error TEXT,
  review_id TEXT, requested_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS coach_review_feedback (
  id TEXT PRIMARY KEY, owner_id TEXT, review_id TEXT NOT NULL UNIQUE, profile_id TEXT NOT NULL,
  profile_revision INTEGER NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(review_id) REFERENCES coach_reviews(id) ON DELETE CASCADE,
  FOREIGN KEY(profile_id, profile_revision) REFERENCES coaching_profiles(profile_id, revision)
);
CREATE TABLE IF NOT EXISTS coach_review_notifications (
  review_id TEXT PRIMARY KEY, delivered_at TEXT NOT NULL,
  FOREIGN KEY(review_id) REFERENCES coach_reviews(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS history_date ON workout_sessions(ended_at DESC);
CREATE INDEX IF NOT EXISTS sets_exercise ON workout_sets(workout_exercise_id, set_number);
CREATE INDEX IF NOT EXISTS coaching_profile_latest ON coaching_profiles(profile_id, revision DESC);
CREATE INDEX IF NOT EXISTS coaching_check_ins_date ON coaching_check_ins(created_at DESC);
CREATE INDEX IF NOT EXISTS coach_reviews_period ON coach_reviews(period_end DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS coaching_requests_status ON coaching_generation_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS coach_feedback_date ON coach_review_feedback(updated_at DESC);
`;

async function initializeDatabaseOnce() {
  const db = await database();
  await db.execAsync(schema);
  const pref = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM preferences');
  if (!pref?.count) await db.runAsync('INSERT INTO preferences VALUES (?, ?, ?, ?)', 'local', 'lb', 90, now());
  await db.withTransactionAsync(async () => {
    for (const exercise of SEEDED_EXERCISES) {
      await db.runAsync(
        'INSERT OR IGNORE INTO exercises VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        exercise.id, null, exercise.name, exercise.muscleGroup, exercise.equipment, exercise.type, 0, 0, exercise.updatedAt,
      );
    }
  });
}

export function initializeDatabase() {
  initializePromise ??= initializeDatabaseOnce();
  return initializePromise;
}

type ExerciseRow = { id: string; owner_id: string | null; name: string; muscle_group: string; equipment: string; type: ExerciseType; is_custom: number; archived: number; updated_at: string };
const exerciseFromRow = (r: ExerciseRow): Exercise => ({ id: r.id, ownerId: r.owner_id, name: r.name, muscleGroup: r.muscle_group, equipment: r.equipment, type: r.type, isCustom: !!r.is_custom, archived: !!r.archived, updatedAt: r.updated_at });

export async function listExercises(search = '', muscle = 'All') {
  const db = await database();
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT * FROM exercises WHERE archived = 0 AND name LIKE ? AND (? = 'All' OR muscle_group = ?) ORDER BY name`,
    `%${search}%`, muscle, muscle,
  );
  return rows.map(exerciseFromRow);
}

export async function createCustomExercise(input: { name: string; muscleGroup: string; equipment: string; type: ExerciseType }) {
  const db = await database(); const id = makeId(); const updatedAt = now();
  await db.runAsync('INSERT INTO exercises VALUES (?,NULL,?,?,?,?,1,0,?)', id, input.name.trim(), input.muscleGroup, input.equipment, input.type, updatedAt);
  await enqueue('exercise', id, 'upsert', { id, ...input, updated_at: updatedAt });
  return id;
}

type RoutineRow = { id: string; owner_id: string | null; name: string; created_at: string; updated_at: string; archived: number };
type RoutineExerciseRow = { id: string; routine_id: string; exercise_id: string; sort_order: number; set_count: number } & ExerciseRow;
export async function listRoutines(): Promise<Routine[]> {
  const db = await database();
  const routines = await db.getAllAsync<RoutineRow>('SELECT * FROM routines WHERE archived = 0 ORDER BY updated_at DESC');
  return Promise.all(routines.map(async (r) => {
    const items = await db.getAllAsync<RoutineExerciseRow>(`SELECT re.*, e.owner_id, e.name, e.muscle_group, e.equipment, e.type, e.is_custom, e.archived, e.updated_at FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id WHERE re.routine_id = ? ORDER BY re.sort_order`, r.id);
    return { id: r.id, ownerId: r.owner_id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at, archived: !!r.archived, exercises: items.map((i) => ({ id: i.id, routineId: i.routine_id, exerciseId: i.exercise_id, sortOrder: i.sort_order, setCount: i.set_count, exercise: exerciseFromRow(i) })) };
  }));
}

export async function getRoutine(id: string) { return (await listRoutines()).find((r) => r.id === id) ?? null; }

export async function saveRoutine(input: { id?: string; name: string; exercises: { exerciseId: string; setCount: number }[] }) {
  const db = await database(); const id = input.id ?? makeId(); const timestamp = now();
  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync('SELECT id FROM routines WHERE id = ?', id);
    if (existing) await db.runAsync('UPDATE routines SET name=?, updated_at=?, archived=0 WHERE id=?', input.name.trim(), timestamp, id);
    else await db.runAsync('INSERT INTO routines VALUES (?,NULL,?,?,?,0)', id, input.name.trim(), timestamp, timestamp);
    await db.runAsync('DELETE FROM routine_exercises WHERE routine_id=?', id);
    for (const [index, item] of input.exercises.entries()) await db.runAsync('INSERT INTO routine_exercises VALUES (?,?,?,?,?,?)', makeId(), id, item.exerciseId, index, item.setCount, timestamp);
  });
  await enqueueRoutine(id);
  return id;
}

export async function duplicateRoutine(id: string) {
  const routine = await getRoutine(id); if (!routine) return;
  return saveRoutine({ name: `${routine.name} Copy`, exercises: routine.exercises.map((e) => ({ exerciseId: e.exerciseId, setCount: e.setCount })) });
}

export async function archiveRoutine(id: string) {
  const db = await database(); const timestamp = now();
  await db.runAsync('UPDATE routines SET archived=1, updated_at=? WHERE id=?', timestamp, id);
  await enqueue('routine', id, 'delete', { id, updated_at: timestamp });
}

export async function getPreferences(): Promise<UserPreferences> {
  const db = await database();
  const row = await db.getFirstAsync<{ unit: WeightUnit; rest_seconds: number; updated_at: string }>('SELECT * FROM preferences WHERE id=?', 'local');
  return { unit: row?.unit ?? 'lb', restSeconds: row?.rest_seconds ?? 90, updatedAt: row?.updated_at ?? now() };
}

export async function savePreferences(input: Pick<UserPreferences, 'unit' | 'restSeconds'>) {
  const db = await database(); const updatedAt = now();
  await db.runAsync('UPDATE preferences SET unit=?,rest_seconds=?,updated_at=? WHERE id=?', input.unit, input.restSeconds, updatedAt, 'local');
  await enqueue('preference', 'local', 'upsert', { unit: input.unit, rest_seconds: input.restSeconds, updated_at: updatedAt });
}

export async function createWorkout(routineId: string | null) {
  const db = await database();
  const active = await db.getFirstAsync<{ id: string }>("SELECT id FROM workout_sessions WHERE status='active'");
  if (active) return active.id;
  const routine = routineId ? await getRoutine(routineId) : null;
  const id = makeId(); const timestamp = now(); const prefs = await getPreferences();
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO workout_sessions VALUES (?,NULL,?,?,?, ?,NULL,?,NULL)', id, routineId, routine?.name ?? 'Quick Workout', 'active', timestamp, timestamp);
    for (const [exerciseIndex, item] of (routine?.exercises ?? []).entries()) {
      const workoutExerciseId = makeId(); const exercise = item.exercise!;
      await db.runAsync('INSERT INTO workout_exercises VALUES (?,?,?,?,?,?,?)', workoutExerciseId, id, exercise.id, exercise.name, exercise.type, exerciseIndex, timestamp);
      for (let setIndex = 0; setIndex < item.setCount; setIndex++) await db.runAsync('INSERT INTO workout_sets (id, workout_exercise_id, set_number, weight, reps, unit, completed_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', makeId(), workoutExerciseId, setIndex + 1, null, null, prefs.unit, null, timestamp);
    }
  });
  return id;
}

type SessionRow = { id: string; owner_id: string | null; routine_id: string | null; name: string; status: 'active'|'completed'; started_at: string; ended_at: string | null; updated_at: string };
type WorkoutExerciseRow = { id: string; session_id: string; exercise_id: string; exercise_name: string; exercise_type: ExerciseType; sort_order: number };
type SetRow = { id: string; workout_exercise_id: string; set_number: number; weight: number | null; reps: number | null; unit: WeightUnit; completed_at: string | null; updated_at: string };

async function hydrateSession(row: SessionRow): Promise<WorkoutSession> {
  const db = await database();
  const exercises = await db.getAllAsync<WorkoutExerciseRow>('SELECT * FROM workout_exercises WHERE session_id=? ORDER BY sort_order', row.id);
  const hydrated: WorkoutExercise[] = [];
  for (const e of exercises) {
    const sets = await db.getAllAsync<SetRow>('SELECT * FROM workout_sets WHERE workout_exercise_id=? ORDER BY set_number', e.id);
    const workoutSets: WorkoutSet[] = [];
    for (const s of sets) {
      const previous = await db.getFirstAsync<{ weight: number | null; reps: number | null; unit: WeightUnit }>(`SELECT ws.weight, ws.reps, ws.unit FROM workout_sets ws JOIN workout_exercises we ON we.id=ws.workout_exercise_id JOIN workout_sessions sess ON sess.id=we.session_id WHERE we.exercise_id=? AND ws.set_number=? AND ws.completed_at IS NOT NULL AND sess.status='completed' ORDER BY sess.ended_at DESC LIMIT 1`, e.exercise_id, s.set_number);
      workoutSets.push({ id: s.id, workoutExerciseId: s.workout_exercise_id, setNumber: s.set_number, weight: s.weight, reps: s.reps, unit: s.unit, completedAt: s.completed_at, updatedAt: s.updated_at, previous: previous ?? null });
    }
    hydrated.push({ id: e.id, sessionId: e.session_id, exerciseId: e.exercise_id, exerciseName: e.exercise_name, exerciseType: e.exercise_type, sortOrder: e.sort_order, sets: workoutSets });
  }
  return { id: row.id, ownerId: row.owner_id, routineId: row.routine_id, name: row.name, status: row.status, startedAt: row.started_at, endedAt: row.ended_at, updatedAt: row.updated_at, exercises: hydrated };
}

export async function getActiveWorkout() {
  const db = await database(); const row = await db.getFirstAsync<SessionRow>("SELECT * FROM workout_sessions WHERE status='active'");
  return row ? hydrateSession(row) : null;
}
export async function getWorkout(id: string) { const db = await database(); const row = await db.getFirstAsync<SessionRow>('SELECT * FROM workout_sessions WHERE id=?', id); return row ? hydrateSession(row) : null; }
export async function listHistory() { const db = await database(); const rows = await db.getAllAsync<SessionRow>("SELECT * FROM workout_sessions WHERE status='completed' ORDER BY ended_at DESC"); return Promise.all(rows.map(hydrateSession)); }

export async function addExerciseToWorkout(sessionId: string, exerciseId: string) {
  const db = await database(); const exerciseRow = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE id=?', exerciseId); if (!exerciseRow) return;
  const order = await db.getFirstAsync<{ value: number }>('SELECT COALESCE(MAX(sort_order),-1)+1 AS value FROM workout_exercises WHERE session_id=?', sessionId);
  const prefs = await getPreferences(); const id = makeId(); const timestamp = now(); const exercise = exerciseFromRow(exerciseRow);
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO workout_exercises VALUES (?,?,?,?,?,?,?)', id, sessionId, exercise.id, exercise.name, exercise.type, order?.value ?? 0, timestamp);
    for (let i=1; i<=3; i++) await db.runAsync('INSERT INTO workout_sets (id, workout_exercise_id, set_number, weight, reps, unit, completed_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', makeId(), id, i, null, null, prefs.unit, null, timestamp);
    await db.runAsync('UPDATE workout_sessions SET updated_at=? WHERE id=?', timestamp, sessionId);
  });
}

export async function removeWorkoutExercise(id: string) { const db = await database(); await db.runAsync('DELETE FROM workout_exercises WHERE id=?', id); }
export async function moveWorkoutExercise(id: string, direction: -1 | 1) {
  const db = await database(); const item = await db.getFirstAsync<WorkoutExerciseRow>('SELECT * FROM workout_exercises WHERE id=?', id); if (!item) return;
  const swap = await db.getFirstAsync<WorkoutExerciseRow>('SELECT * FROM workout_exercises WHERE session_id=? AND sort_order=?', item.session_id, item.sort_order + direction); if (!swap) return;
  await db.withTransactionAsync(async () => { await db.runAsync('UPDATE workout_exercises SET sort_order=-1 WHERE id=?', id); await db.runAsync('UPDATE workout_exercises SET sort_order=? WHERE id=?', item.sort_order, swap.id); await db.runAsync('UPDATE workout_exercises SET sort_order=? WHERE id=?', swap.sort_order, id); });
}

export async function addSet(workoutExerciseId: string) {
  const db = await database(); const value = await db.getFirstAsync<{ value: number }>('SELECT COALESCE(MAX(set_number),0)+1 AS value FROM workout_sets WHERE workout_exercise_id=?', workoutExerciseId); const prefs = await getPreferences();
  await db.runAsync('INSERT INTO workout_sets (id, workout_exercise_id, set_number, weight, reps, unit, completed_at, updated_at) VALUES (?,?,?,?,?,?,?,?)', makeId(), workoutExerciseId, value?.value ?? 1, null, null, prefs.unit, null, now());
}
export async function removeSet(id: string) { const db = await database(); await db.runAsync('DELETE FROM workout_sets WHERE id=? AND completed_at IS NULL', id); }
export async function updateSet(id: string, field: 'weight'|'reps', value: number | null) { const db = await database(); await db.runAsync(`UPDATE workout_sets SET ${field}=?, updated_at=? WHERE id=? AND completed_at IS NULL`, value, now(), id); }
export async function toggleSet(id: string) {
  const db = await database(); const set = await db.getFirstAsync<SetRow>('SELECT * FROM workout_sets WHERE id=?', id); if (!set) return false;
  const completedAt = set.completed_at ? null : now();
  await db.runAsync('UPDATE workout_sets SET completed_at=?,updated_at=? WHERE id=?', completedAt, now(), id);
  return !!completedAt;
}

export async function finishWorkout(id: string) {
  const db = await database(); const count = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM workout_sets ws JOIN workout_exercises we ON we.id=ws.workout_exercise_id WHERE we.session_id=? AND ws.completed_at IS NOT NULL`, id);
  if (!count?.count) throw new Error('Complete at least one set before finishing.');
  const timestamp = now();
  await db.withTransactionAsync(async () => { await db.runAsync(`DELETE FROM workout_sets WHERE completed_at IS NULL AND workout_exercise_id IN (SELECT id FROM workout_exercises WHERE session_id=?)`, id); await db.runAsync("UPDATE workout_sessions SET status='completed',ended_at=?,updated_at=? WHERE id=?", timestamp, timestamp, id); });
  await enqueueWorkout(id);
}
export async function discardWorkout(id: string) { const db = await database(); await db.runAsync("DELETE FROM workout_sessions WHERE id=? AND status='active'", id); }

// Corrects a completed workout's name, date, and completed sets in one atomic transaction,
// then re-enqueues a single full snapshot so the correction survives push/pull and remote merge.
export async function saveHistoryEdits(id: string, input: { name: string; startedAt: string; endedAt: string; sets: { id: string; weight: number | null; reps: number }[] }) {
  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error('Name is required.');
  if (new Date(input.endedAt).getTime() < new Date(input.startedAt).getTime()) throw new Error('End date cannot be before start date.');
  const db = await database();
  const rows = await db.getAllAsync<{ id: string; exercise_type: ExerciseType }>(
    `SELECT ws.id, we.exercise_type FROM workout_sets ws JOIN workout_exercises we ON we.id = ws.workout_exercise_id WHERE we.session_id = ? AND ws.completed_at IS NOT NULL`, id,
  );
  const typeById = new Map(rows.map((r) => [r.id, r.exercise_type]));
  for (const set of input.sets) {
    const type = typeById.get(set.id);
    if (!type) throw new Error('Set not found.');
    if (!canCompleteSet(type, set.weight, set.reps)) throw new Error(type === 'weighted' ? 'Enter weight and reps for every set.' : 'Enter reps for every set.');
  }
  const timestamp = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE workout_sessions SET name=?, started_at=?, ended_at=?, updated_at=? WHERE id=?', trimmedName, input.startedAt, input.endedAt, timestamp, id);
    for (const set of input.sets) await db.runAsync('UPDATE workout_sets SET weight=?, reps=?, updated_at=? WHERE id=?', set.weight, set.reps, timestamp, set.id);
  });
  await enqueueWorkout(id);
}

// Permanently removes a completed workout. Local cascade (FK ON DELETE CASCADE) drops its
// exercises/sets; the outbox 'delete' entry tells the remote side to do the same.
export async function deleteWorkout(id: string) {
  const db = await database();
  const timestamp = now();
  await db.runAsync('DELETE FROM workout_sessions WHERE id=?', id);
  await enqueue('workout', id, 'delete', { id, updated_at: timestamp });
}

// Removes one exercise (and its sets) from a completed workout's history. Refuses to remove
// the workout's only exercise — use deleteWorkout for that. Enqueues an explicit remote delete
// for the exercise (upsert alone can't remove a row) plus a refreshed session snapshot.
export async function deleteHistoryExercise(workoutExerciseId: string) {
  const db = await database();
  const row = await db.getFirstAsync<{ session_id: string }>('SELECT session_id FROM workout_exercises WHERE id=?', workoutExerciseId);
  if (!row) return;
  const count = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM workout_exercises WHERE session_id=?', row.session_id);
  if ((count?.count ?? 0) <= 1) throw new Error('Delete the whole workout instead of its only exercise.');
  const timestamp = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workout_exercises WHERE id=?', workoutExerciseId);
    await db.runAsync('UPDATE workout_sessions SET updated_at=? WHERE id=?', timestamp, row.session_id);
  });
  await enqueue('workout_exercise', workoutExerciseId, 'delete', { id: workoutExerciseId, session_id: row.session_id, updated_at: timestamp });
  await enqueueWorkout(row.session_id);
}

// Removes one completed set from history. Refuses to remove an exercise's only completed set —
// use deleteHistoryExercise for that.
export async function deleteHistorySet(setId: string) {
  const db = await database();
  const set = await db.getFirstAsync<{ workout_exercise_id: string }>('SELECT workout_exercise_id FROM workout_sets WHERE id=? AND completed_at IS NOT NULL', setId);
  if (!set) return;
  const exercise = await db.getFirstAsync<{ session_id: string }>('SELECT session_id FROM workout_exercises WHERE id=?', set.workout_exercise_id);
  if (!exercise) return;
  const count = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM workout_sets WHERE workout_exercise_id=? AND completed_at IS NOT NULL', set.workout_exercise_id);
  if ((count?.count ?? 0) <= 1) throw new Error('Delete the whole exercise instead of its only set.');
  const timestamp = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workout_sets WHERE id=?', setId);
    await db.runAsync('UPDATE workout_sessions SET updated_at=? WHERE id=?', timestamp, exercise.session_id);
  });
  await enqueue('workout_set', setId, 'delete', { id: setId, updated_at: timestamp });
  await enqueueWorkout(exercise.session_id);
}

export type OutboxRow = { id: string; entity: string; entity_id: string; operation: string; payload: string; attempts: number };
async function enqueueWithDatabase(db: SQLite.SQLiteDatabase, entity: string, entityId: string, operation: string, payload: unknown) {
  await db.runAsync('DELETE FROM outbox WHERE entity=? AND entity_id=?', entity, entityId);
  await db.runAsync('INSERT INTO outbox VALUES (?,?,?,?,?,?,0,NULL)', makeId(), entity, entityId, operation, JSON.stringify(payload), now());
}
export async function enqueue(entity: string, entityId: string, operation: string, payload: unknown) { const db = await database(); await enqueueWithDatabase(db, entity, entityId, operation, payload); }
async function enqueueRoutine(id: string) { const routine = await getRoutine(id); if (routine) await enqueue('routine', id, 'snapshot', routine); }
async function enqueueWorkout(id: string) { const workout = await getWorkout(id); if (workout) await enqueue('workout', id, 'snapshot', workout); }
export async function getOutbox() { const db = await database(); return db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY created_at, rowid LIMIT 50'); }
export async function completeOutbox(id: string) { const db = await database(); await db.runAsync('DELETE FROM outbox WHERE id=?', id); }
export async function failOutbox(id: string, error: string) { const db = await database(); await db.runAsync('UPDATE outbox SET attempts=attempts+1,last_error=? WHERE id=?', error, id); }
export async function attachLocalOwner(ownerId: string) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE exercises SET owner_id=? WHERE is_custom=1 AND owner_id IS NULL', ownerId);
    await db.runAsync('UPDATE routines SET owner_id=? WHERE owner_id IS NULL', ownerId);
    await db.runAsync('UPDATE workout_sessions SET owner_id=? WHERE owner_id IS NULL', ownerId);
    await db.runAsync('UPDATE coaching_profiles SET owner_id=? WHERE owner_id IS NULL', ownerId);
    await db.runAsync('UPDATE coaching_check_ins SET owner_id=? WHERE owner_id IS NULL', ownerId);
    await db.runAsync('UPDATE coach_reviews SET owner_id=? WHERE owner_id IS NULL', ownerId);
    await db.runAsync('UPDATE coaching_generation_requests SET owner_id=? WHERE owner_id IS NULL', ownerId);
    await db.runAsync('UPDATE coach_review_feedback SET owner_id=? WHERE owner_id IS NULL', ownerId);
  });
}

type CoachingProfileRow = { payload: string };
type CoachingCheckInRow = { payload: string };

function parseCoachingProfile(row: CoachingProfileRow | null): CoachingProfileV1 | null {
  if (!row) return null;
  const validation = validateCoachingProfile(JSON.parse(row.payload));
  if (!validation.ok) throw new Error(`Stored coaching profile is invalid: ${validation.errors.join(' ')}`);
  return validation.value;
}

function parseCoachingCheckIn(row: CoachingCheckInRow): CoachingCheckInV1 {
  const validation = validateCoachingCheckIn(JSON.parse(row.payload));
  if (!validation.ok) throw new Error(`Stored coaching check-in is invalid: ${validation.errors.join(' ')}`);
  return validation.value;
}

export async function getCurrentCoachingProfile(): Promise<CoachingProfileV1 | null> {
  const db = await database();
  return parseCoachingProfile(await db.getFirstAsync<CoachingProfileRow>('SELECT payload FROM coaching_profiles ORDER BY effective_at DESC, revision DESC LIMIT 1'));
}

export async function listCoachingProfileRevisions(profileId?: string): Promise<CoachingProfileV1[]> {
  const db = await database();
  const rows = profileId
    ? await db.getAllAsync<CoachingProfileRow>('SELECT payload FROM coaching_profiles WHERE profile_id=? ORDER BY revision DESC', profileId)
    : await db.getAllAsync<CoachingProfileRow>('SELECT payload FROM coaching_profiles ORDER BY effective_at DESC, revision DESC');
  return rows.map((row) => parseCoachingProfile(row)!);
}

export async function saveCoachingProfileRevision(profile: CoachingProfileV1): Promise<void> {
  const validation = validateCoachingProfile(profile);
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  const db = await database();
  const latest = await db.getFirstAsync<{ profile_id: string; revision: number }>('SELECT profile_id, revision FROM coaching_profiles ORDER BY effective_at DESC, revision DESC LIMIT 1');
  if (latest && latest.profile_id !== profile.id) throw new Error('Profile identity cannot change when creating a revision.');
  if ((latest?.revision ?? 0) + 1 !== profile.revision) throw new Error(`Profile revision must be ${(latest?.revision ?? 0) + 1}.`);
  const revisionId = `${profile.id}:${profile.revision}`;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO coaching_profiles (revision_id,profile_id,revision,owner_id,payload,effective_at,updated_at) VALUES (?,?,?,NULL,?,?,?)',
      revisionId, profile.id, profile.revision, JSON.stringify(validation.value), profile.effectiveAt, profile.updatedAt,
    );
    await enqueueWithDatabase(db, 'coaching_profile', revisionId, 'upsert', validation.value);
  });
}

export async function listCoachingCheckIns(profileId?: string): Promise<CoachingCheckInV1[]> {
  const db = await database();
  const rows = profileId
    ? await db.getAllAsync<CoachingCheckInRow>('SELECT payload FROM coaching_check_ins WHERE profile_id=? ORDER BY created_at DESC', profileId)
    : await db.getAllAsync<CoachingCheckInRow>('SELECT payload FROM coaching_check_ins ORDER BY created_at DESC');
  return rows.map(parseCoachingCheckIn);
}

export async function saveCoachingCheckIn(checkIn: CoachingCheckInV1): Promise<void> {
  const validation = validateCoachingCheckIn(checkIn);
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  const db = await database();
  const profile = await db.getFirstAsync('SELECT revision_id FROM coaching_profiles WHERE profile_id=? AND revision=?', checkIn.profileId, checkIn.profileRevision);
  if (!profile) throw new Error('The referenced coaching profile revision does not exist.');
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO coaching_check_ins (id,owner_id,profile_id,profile_revision,payload,created_at,updated_at) VALUES (?,NULL,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at WHERE excluded.updated_at > coaching_check_ins.updated_at',
      checkIn.id, checkIn.profileId, checkIn.profileRevision, JSON.stringify(validation.value), checkIn.createdAt, checkIn.updatedAt,
    );
    await enqueueWithDatabase(db, 'coaching_check_in', checkIn.id, 'upsert', validation.value);
  });
}

export async function getWeeklyCoachingMetrics(at = new Date()): Promise<WeeklyCoachingMetricsV1 | null> {
  const profile = await getCurrentCoachingProfile();
  if (!profile) return null;
  return calculateWeeklyCoachingMetrics(await listHistory(), profile, at);
}

export async function getCoachingContext(at = new Date()): Promise<CoachingContextV1 | null> {
  const profile = await getCurrentCoachingProfile();
  if (!profile || !profile.consent.coachingEnabled || !profile.consent.shareWorkoutHistory) return null;
  const workouts = await listHistory();
  const metrics = calculateWeeklyCoachingMetrics(workouts, profile, at);
  const [routines, checkIns, feedback] = await Promise.all([listRoutines(), listCoachingCheckIns(profile.id), listCoachReviewFeedback()]);
  const latestFeedback=feedback[0]??null;
  return buildCoachingContext({ profile, metrics, workouts, currentRoutine: routines[0] ?? null, checkIns, priorReviewDecision:latestFeedback?{feedbackId:latestFeedback.id,reviewId:latestFeedback.reviewId,usefulness:latestFeedback.usefulness,tone:latestFeedback.tone,note:latestFeedback.changedConstraints,updatedAt:latestFeedback.updatedAt}:null });
}

export interface CoachReviewListItem { record: StoredCoachReviewV1; archivedAt: string | null }

function parseCoachReview(row: { payload: string; archived_at: string | null }): CoachReviewListItem {
  const validation = validateStoredCoachReview(JSON.parse(row.payload));
  if (!validation.ok) throw new Error(`Stored coach review is invalid: ${validation.errors.join(' ')}`);
  return { record: validation.value, archivedAt: row.archived_at };
}

export async function listCoachReviews(includeArchived = false): Promise<CoachReviewListItem[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ payload: string; archived_at: string | null }>(`SELECT payload,archived_at FROM coach_reviews ${includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY period_end DESC,published_at DESC`);
  return rows.map(parseCoachReview);
}

export async function getCoachReview(id: string): Promise<CoachReviewListItem | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ payload: string; archived_at: string | null }>('SELECT payload,archived_at FROM coach_reviews WHERE id=?', id);
  return row ? parseCoachReview(row) : null;
}

export async function saveCoachReview(record: StoredCoachReviewV1): Promise<string> {
  const validation = validateStoredCoachReview(record);
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  const db = await database();
  const duplicate = await db.getFirstAsync<{ id: string }>('SELECT id FROM coach_reviews WHERE generation_key=?', record.generationKey);
  if (duplicate) return duplicate.id;
  const profile = await db.getFirstAsync('SELECT revision_id FROM coaching_profiles WHERE profile_id=? AND revision=?', record.profileId, record.profileRevision);
  if (!profile) throw new Error('The review profile revision does not exist locally.');
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO coach_reviews (id,owner_id,generation_key,payload,profile_id,profile_revision,context_version,period_start,period_end,latest_workout_id,published_at,archived_at) VALUES (?,NULL,?,?,?,?,?,?,?,?,?,NULL)', record.id, record.generationKey, JSON.stringify(validation.value), record.profileId, record.profileRevision, record.contextVersion, record.review.periodStart, record.review.periodEnd, record.review.latestWorkoutId, record.publishedAt);
    await enqueueWithDatabase(db, 'coach_review', record.id, 'insert', validation.value);
  });
  return record.id;
}

export async function archiveCoachReview(id: string): Promise<void> {
  const db = await database(); const timestamp = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE coach_reviews SET archived_at=? WHERE id=?', timestamp, id);
    await enqueueWithDatabase(db, 'coach_review_archive', id, 'update', { id, archived_at: timestamp });
  });
}

function parseGenerationRequest(row: { context: string; id: string; generation_key: string; status: CoachingGenerationRequestV1['status']; attempts: number; requested_at: string; updated_at: string; next_attempt_at: string | null; last_error: string | null; review_id: string | null }): CoachingGenerationRequestV1 {
  const value = { requestVersion: 1, id: row.id, generationKey: row.generation_key, context: JSON.parse(row.context), status: row.status, attempts: row.attempts, requestedAt: row.requested_at, updatedAt: row.updated_at, nextAttemptAt: row.next_attempt_at, lastError: row.last_error, reviewId: row.review_id } as CoachingGenerationRequestV1;
  const validation = validateGenerationRequest(value);
  if (!validation.ok) throw new Error(`Stored generation request is invalid: ${validation.errors.join(' ')}`);
  return validation.value;
}

export async function listCoachingGenerationRequests(): Promise<CoachingGenerationRequestV1[]> {
  const db = await database();
  const rows = await db.getAllAsync<Parameters<typeof parseGenerationRequest>[0]>('SELECT * FROM coaching_generation_requests ORDER BY requested_at DESC');
  return rows.map(parseGenerationRequest);
}

export async function requestCoachReview(at = new Date()): Promise<CoachingGenerationRequestV1> {
  const context = await getCoachingContext(at);
  if (!context) throw new Error('Enable Coach and workout-history access before requesting a review.');
  const db = await database();
  const existing = await db.getFirstAsync<Parameters<typeof parseGenerationRequest>[0]>('SELECT * FROM coaching_generation_requests WHERE generation_key=?', context.generationKey);
  if (existing) return parseGenerationRequest(existing);
  const timestamp = now();
  const request: CoachingGenerationRequestV1 = { requestVersion: 1, id: makeId(), generationKey: context.generationKey, context, status: 'pending', attempts: 0, requestedAt: timestamp, updatedAt: timestamp, nextAttemptAt: null, lastError: null, reviewId: null };
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO coaching_generation_requests (id,owner_id,generation_key,context,status,attempts,next_attempt_at,last_error,review_id,requested_at,updated_at) VALUES (?,NULL,?,?,?,0,NULL,NULL,NULL,?,?)', request.id, request.generationKey, JSON.stringify(context), request.status, request.requestedAt, request.updatedAt);
    await enqueueWithDatabase(db, 'coaching_request', request.id, 'insert', request);
  });
  return request;
}

export async function scheduleWeeklyCoachReview(at = new Date()): Promise<WeeklyScheduleDecision> {
  const decision = weeklyScheduleDecision(await getCurrentCoachingProfile(), await listCoachingGenerationRequests(), at);
  if (decision.shouldRequest) await requestCoachReview(at);
  return decision;
}

export async function hasDeliveredCoachReviewNotification(reviewId: string): Promise<boolean> {
  const db = await database();
  return !!(await db.getFirstAsync('SELECT review_id FROM coach_review_notifications WHERE review_id=?', reviewId));
}

export async function markCoachReviewNotificationDelivered(reviewId: string): Promise<void> {
  const db = await database();
  await db.runAsync('INSERT OR IGNORE INTO coach_review_notifications (review_id,delivered_at) VALUES (?,?)', reviewId, now());
}

export async function deleteCoachingData(): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM outbox WHERE entity LIKE 'coach%' OR entity LIKE 'coaching_%'");
    await db.runAsync('DELETE FROM coach_review_notifications');
    await db.runAsync('DELETE FROM coach_review_feedback');
    await db.runAsync('DELETE FROM coaching_generation_requests');
    await db.runAsync('DELETE FROM coach_reviews');
    await db.runAsync('DELETE FROM coaching_check_ins');
    await db.runAsync('DELETE FROM coaching_profiles');
    await enqueueWithDatabase(db, 'coach_data_delete', 'current-user', 'delete', { requested_at: now() });
  });
}

export async function retryCoachingGenerationRequest(id: string): Promise<void> {
  const db = await database(); const timestamp = now();
  const row = await db.getFirstAsync<Parameters<typeof parseGenerationRequest>[0]>('SELECT * FROM coaching_generation_requests WHERE id=?', id);
  if (!row) throw new Error('Generation request not found.');
  const request = parseGenerationRequest(row);
  if (request.status === 'ready') return;
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE coaching_generation_requests SET status='pending',next_attempt_at=NULL,last_error=NULL,updated_at=? WHERE id=?", timestamp, id);
    await enqueueWithDatabase(db, 'coaching_request_retry', id, 'update', { id, updated_at: timestamp });
  });
}

function parseCoachFeedback(row:{payload:string}):CoachReviewFeedbackV1{const validation=validateCoachReviewFeedback(JSON.parse(row.payload));if(!validation.ok)throw new Error(`Stored coach feedback is invalid: ${validation.errors.join(' ')}`);return validation.value}
export async function listCoachReviewFeedback():Promise<CoachReviewFeedbackV1[]>{const db=await database();const rows=await db.getAllAsync<{payload:string}>('SELECT payload FROM coach_review_feedback ORDER BY updated_at DESC');return rows.map(parseCoachFeedback)}
export async function saveCoachReviewFeedback(feedback:CoachReviewFeedbackV1):Promise<void>{const validation=validateCoachReviewFeedback(feedback);if(!validation.ok)throw new Error(validation.errors.join(' '));const db=await database();const review=await db.getFirstAsync('SELECT id FROM coach_reviews WHERE id=?',feedback.reviewId);if(!review)throw new Error('The reviewed coaching record does not exist locally.');await db.withTransactionAsync(async()=>{await db.runAsync('INSERT INTO coach_review_feedback (id,owner_id,review_id,profile_id,profile_revision,payload,created_at,updated_at) VALUES (?,NULL,?,?,?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET id=excluded.id,profile_id=excluded.profile_id,profile_revision=excluded.profile_revision,payload=excluded.payload,updated_at=excluded.updated_at WHERE excluded.updated_at >= coach_review_feedback.updated_at',feedback.id,feedback.reviewId,feedback.profileId,feedback.profileRevision,JSON.stringify(validation.value),feedback.createdAt,feedback.updatedAt);await enqueueWithDatabase(db,'coach_review_feedback',feedback.reviewId,'upsert',validation.value)})}

export async function mergeRemoteData(bundle: { exercises: any[]; routines: any[]; workouts: any[]; preference: any | null; coachingProfiles: any[]; coachingCheckIns: any[]; coachReviews: any[]; coachingRequests: any[]; coachFeedback: any[] }) {
  const db = await database();
  const remoteReviews = classifyRemoteCoachReviews(bundle.coachReviews);
  for (const [id, errors] of remoteReviews.rejected) console.warn(`[sync] quarantined invalid remote coach review ${id}:`, errors.join(' '));
  await db.withTransactionAsync(async () => {
    for (const e of bundle.exercises) await db.runAsync(`INSERT INTO exercises VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,name=excluded.name,muscle_group=excluded.muscle_group,equipment=excluded.equipment,type=excluded.type,archived=excluded.archived,updated_at=excluded.updated_at WHERE excluded.updated_at > exercises.updated_at`, e.id,e.owner_id,e.name,e.muscle_group,e.equipment,e.type,e.is_custom?1:0,e.archived?1:0,e.updated_at);
    for (const r of bundle.routines) {
      const local = await db.getFirstAsync<{updated_at:string}>('SELECT updated_at FROM routines WHERE id=?',r.id);
      if (local && local.updated_at >= r.updated_at) continue;
      await db.runAsync(`INSERT INTO routines VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,name=excluded.name,updated_at=excluded.updated_at,archived=excluded.archived`,r.id,r.owner_id,r.name,r.created_at,r.updated_at,r.archived?1:0);
      await db.runAsync('DELETE FROM routine_exercises WHERE routine_id=?',r.id);
      for (const item of r.routine_exercises??[]) await db.runAsync('INSERT INTO routine_exercises VALUES (?,?,?,?,?,?)',item.id,r.id,item.exercise_id,item.sort_order,item.set_count,item.updated_at);
    }
    for (const w of bundle.workouts) {
      const local = await db.getFirstAsync<{updated_at:string}>('SELECT updated_at FROM workout_sessions WHERE id=?',w.id);
      if (local && local.updated_at >= w.updated_at) continue;
      await db.runAsync(`INSERT INTO workout_sessions VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,routine_id=excluded.routine_id,name=excluded.name,status=excluded.status,started_at=excluded.started_at,ended_at=excluded.ended_at,updated_at=excluded.updated_at,synced_at=excluded.synced_at`,w.id,w.owner_id,w.routine_id,w.name,w.status,w.started_at,w.ended_at,w.updated_at,now());
      await db.runAsync('DELETE FROM workout_exercises WHERE session_id=?',w.id);
      for (const e of w.workout_exercises??[]) {
        await db.runAsync('INSERT INTO workout_exercises VALUES (?,?,?,?,?,?,?)',e.id,w.id,e.exercise_id,e.exercise_name,e.exercise_type,e.sort_order,e.updated_at);
        for (const s of e.workout_sets??[]) await db.runAsync('INSERT INTO workout_sets (id, workout_exercise_id, set_number, weight, reps, unit, completed_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',s.id,e.id,s.set_number,s.weight,s.reps,s.unit,s.completed_at,s.updated_at);
      }
    }
    if (bundle.preference) {
      const p=bundle.preference;
      await db.runAsync(`UPDATE preferences SET unit=?,rest_seconds=?,updated_at=? WHERE id='local' AND updated_at < ?`,p.unit,p.rest_seconds,p.updated_at,p.updated_at);
    }
    for (const row of bundle.coachingProfiles) {
      const validation = validateCoachingProfile(row.payload);
      if (!validation.ok) throw new Error(`Remote coaching profile is invalid: ${validation.errors.join(' ')}`);
      const profile = validation.value;
      await db.runAsync(
        'INSERT OR IGNORE INTO coaching_profiles (revision_id,profile_id,revision,owner_id,payload,effective_at,updated_at) VALUES (?,?,?,?,?,?,?)',
        `${profile.id}:${profile.revision}`, profile.id, profile.revision, row.owner_id, JSON.stringify(profile), profile.effectiveAt, profile.updatedAt,
      );
    }
    for (const row of bundle.coachingCheckIns) {
      const validation = validateCoachingCheckIn(row.payload);
      if (!validation.ok) throw new Error(`Remote coaching check-in is invalid: ${validation.errors.join(' ')}`);
      const checkIn = validation.value;
      await db.runAsync(
        'INSERT INTO coaching_check_ins (id,owner_id,profile_id,profile_revision,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,payload=excluded.payload,updated_at=excluded.updated_at WHERE excluded.updated_at > coaching_check_ins.updated_at',
        checkIn.id, row.owner_id, checkIn.profileId, checkIn.profileRevision, JSON.stringify(checkIn), checkIn.createdAt, checkIn.updatedAt,
      );
    }
    for (const { row, review } of remoteReviews.accepted) {
      await db.runAsync(
        'INSERT OR IGNORE INTO coach_reviews (id,owner_id,generation_key,payload,profile_id,profile_revision,context_version,period_start,period_end,latest_workout_id,published_at,archived_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        review.id, row.owner_id, review.generationKey, JSON.stringify(review), review.profileId, review.profileRevision, review.contextVersion, review.review.periodStart, review.review.periodEnd, review.review.latestWorkoutId, review.publishedAt, row.archived_at,
      );
      if (row.archived_at) await db.runAsync('UPDATE coach_reviews SET archived_at=? WHERE id=? AND (archived_at IS NULL OR archived_at < ?)', row.archived_at, review.id, row.archived_at);
    }
    for (const row of bundle.coachingRequests) {
      const rejectedReview = typeof row.review_id === 'string' && remoteReviews.rejected.has(row.review_id);
      const value = { requestVersion: row.request_version, id: row.id, generationKey: row.generation_key, context: row.context, status: rejectedReview ? 'failed' : row.status, attempts: row.attempts, requestedAt: row.requested_at, updatedAt: row.updated_at, nextAttemptAt: row.next_attempt_at, lastError: rejectedReview ? 'The published review was rejected because it did not match the WorkoutPal contract.' : row.last_error, reviewId: rejectedReview ? null : row.review_id };
      const validation = validateGenerationRequest(value);
      if (!validation.ok) throw new Error(`Remote generation request is invalid: ${validation.errors.join(' ')}`);
      await db.runAsync('INSERT INTO coaching_generation_requests (id,owner_id,generation_key,context,status,attempts,next_attempt_at,last_error,review_id,requested_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,status=excluded.status,attempts=excluded.attempts,next_attempt_at=excluded.next_attempt_at,last_error=excluded.last_error,review_id=excluded.review_id,updated_at=excluded.updated_at WHERE excluded.updated_at > coaching_generation_requests.updated_at', row.id, row.owner_id, row.generation_key, JSON.stringify(row.context), row.status, row.attempts, row.next_attempt_at, row.last_error, row.review_id, row.requested_at, row.updated_at);
    }
    for(const row of bundle.coachFeedback){const validation=validateCoachReviewFeedback(row.payload);if(!validation.ok)throw new Error(`Remote coach feedback is invalid: ${validation.errors.join(' ')}`);const feedback=validation.value;await db.runAsync('INSERT INTO coach_review_feedback (id,owner_id,review_id,profile_id,profile_revision,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET id=excluded.id,owner_id=excluded.owner_id,profile_id=excluded.profile_id,profile_revision=excluded.profile_revision,payload=excluded.payload,updated_at=excluded.updated_at WHERE excluded.updated_at > coach_review_feedback.updated_at',feedback.id,row.owner_id,feedback.reviewId,feedback.profileId,feedback.profileRevision,JSON.stringify(feedback),feedback.createdAt,feedback.updatedAt)}
  });
}
