import type { ResolvedExercise } from '@/components/exercises/exercises.repository';

export interface CreatedWorkoutEntry {
  id: string;
  userId: string;
  exerciseName: string;
  performedAt: string;
  createdAt: string;
  sets: CreatedSet[];
}

export interface CreatedSet {
  id: string;
  setOrder: number;
  reps: number;
  weight: number;
  unit: string;
  weightKg: number;
}

export interface InsertEntryRow {
  id: string;
  userId: string;
  exerciseId: string;
  performedAt: Date;
}

export interface InsertSetRow {
  id: string;
  workoutEntryId: string;
  setOrder: number;
  reps: number;
  weight: number;
  unit: string;
  weightKg: number;
}

export type BuildRowsFn = (exerciseMap: Map<string, ResolvedExercise>) => {
  entries: InsertEntryRow[];
  sets: InsertSetRow[];
};

export interface PgDriverError {
  code?: string;
  constraint?: string;
}

export interface FindHistoryParams {
  userId: string;
  exerciseName?: string;
  muscleGroup?: string;
  from?: string;
  to?: string;
  cursorPerformedAt?: string;
  cursorId?: string;
  limit: number;
}

export interface WorkoutHistoryEntry {
  id: string;
  userId: string;
  exerciseName: string;
  performedAt: string;
  createdAt: string;
  sets: WorkoutHistorySet[];
}

export interface WorkoutHistorySet {
  id: string;
  setOrder: number;
  reps: number;
  weight: number;
  unit: string;
  weightKg: number;
}

export interface WorkoutHistoryResponse {
  data: WorkoutHistoryEntry[];
  pagination: {
    limit: number;
    cursor: string | null;
  };
}
