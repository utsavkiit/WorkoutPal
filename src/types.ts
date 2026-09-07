export type ExerciseType = 'weighted' | 'bodyweight';
export type WeightUnit = 'lb' | 'kg';
export type SessionStatus = 'active' | 'completed';
export interface Exercise { id:string; ownerId:string|null; name:string; muscleGroup:string; equipment:string; type:ExerciseType; isCustom:boolean; archived:boolean; updatedAt:string }
export interface RoutineExercise { id:string; routineId:string; exerciseId:string; sortOrder:number; setCount:number; exercise?:Exercise }
export interface Routine { id:string; ownerId:string|null; name:string; createdAt:string; updatedAt:string; archived:boolean; exercises:RoutineExercise[] }
export interface WorkoutSet { id:string; workoutExerciseId:string; setNumber:number; weight:number|null; reps:number|null; unit:WeightUnit; completedAt:string|null; updatedAt:string; previous?:{weight:number|null;reps:number|null;unit:WeightUnit}|null }
export interface WorkoutExercise { id:string; sessionId:string; exerciseId:string; exerciseName:string; exerciseType:ExerciseType; sortOrder:number; sets:WorkoutSet[] }
export interface WorkoutSession { id:string; ownerId:string|null; routineId:string|null; name:string; status:SessionStatus; startedAt:string; endedAt:string|null; updatedAt:string; exercises:WorkoutExercise[] }
export interface UserPreferences { unit:WeightUnit; restSeconds:number; updatedAt:string }
export type SyncStatus='offline'|'idle'|'syncing'|'error';
