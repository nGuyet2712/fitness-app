import { v4 as uuidv4 } from 'uuid';
import { ExerciseSet } from '../../src/db/entities';
import { getTestDataSource } from '../helpers/typeorm-connection';

export function exerciseSetRepo() {
  return getTestDataSource().getRepository(ExerciseSet);
}

export async function insertExerciseSet(data: {
  workoutEntryId: string;
  setOrder: number;
  reps: number;
  weight: number;
  unit: string;
  weightKg: number;
}): Promise<ExerciseSet> {
  const repo = exerciseSetRepo();
  const set = repo.create({ id: uuidv4(), ...data });
  return repo.save(set);
}

export async function countExerciseSets(): Promise<number> {
  return exerciseSetRepo().count();
}
