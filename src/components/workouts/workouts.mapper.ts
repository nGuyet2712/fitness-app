import type { InsertEntryRow, InsertSetRow } from './workouts.types';

export function mapEntriesToValues(
  entries: InsertEntryRow[],
): { id: string; userId: string; exerciseId: string; performedAt: Date }[] {
  return entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    exerciseId: e.exerciseId,
    performedAt: e.performedAt,
  }));
}

export function mapSetsToValues(sets: InsertSetRow[]): {
  id: string;
  workoutEntryId: string;
  setOrder: number;
  reps: number;
  weight: number;
  unit: string;
  weightKg: number;
}[] {
  return sets.map((s) => ({
    id: s.id,
    workoutEntryId: s.workoutEntryId,
    setOrder: s.setOrder,
    reps: s.reps,
    weight: s.weight,
    unit: s.unit,
    weightKg: s.weightKg,
  }));
}
