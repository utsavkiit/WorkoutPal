import * as SQLite from 'expo-sqlite';
import { SEEDED_EXERCISES } from './exercises';
import { Exercise, ExerciseType, Routine, RoutineExercise, UserPreferences, WeightUnit, WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { now } from '../utils';
import { makeId } from './id';

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
CREATE INDEX IF NOT EXISTS history_date ON workout_sessions(ended_at DESC);
CREATE INDEX IF NOT EXISTS sets_exercise ON workout_sets(workout_exercise_id, set_number);
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

export type OutboxRow = { id: string; entity: string; entity_id: string; operation: string; payload: string; attempts: number };
export async function enqueue(entity: string, entityId: string, operation: string, payload: unknown) { const db = await database(); await db.runAsync('DELETE FROM outbox WHERE entity=? AND entity_id=?', entity, entityId); await db.runAsync('INSERT INTO outbox VALUES (?,?,?,?,?,?,0,NULL)', makeId(), entity, entityId, operation, JSON.stringify(payload), now()); }
async function enqueueRoutine(id: string) { const routine = await getRoutine(id); if (routine) await enqueue('routine', id, 'snapshot', routine); }
async function enqueueWorkout(id: string) { const workout = await getWorkout(id); if (workout) await enqueue('workout', id, 'snapshot', workout); }
export async function getOutbox() { const db = await database(); return db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY created_at LIMIT 50'); }
export async function completeOutbox(id: string) { const db = await database(); await db.runAsync('DELETE FROM outbox WHERE id=?', id); }
export async function failOutbox(id: string, error: string) { const db = await database(); await db.runAsync('UPDATE outbox SET attempts=attempts+1,last_error=? WHERE id=?', error, id); }
export async function attachLocalOwner(ownerId: string) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE exercises SET owner_id=? WHERE is_custom=1 AND owner_id IS NULL', ownerId);
    await db.runAsync('UPDATE routines SET owner_id=? WHERE owner_id IS NULL', ownerId);
    await db.runAsync('UPDATE workout_sessions SET owner_id=? WHERE owner_id IS NULL', ownerId);
  });
}

export async function mergeRemoteData(bundle: { exercises: any[]; routines: any[]; workouts: any[]; preference: any | null }) {
  const db = await database();
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
  });
}
