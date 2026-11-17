import { v4 as uuidv4 } from 'uuid';
import { WorkoutEntry } from '../../src/db/entities';
import { getTestDataSource } from '../helpers/typeorm-connection';

export function workoutEntryRepo() {
  return getTestDataSource().getRepository(WorkoutEntry);
}

export async function insertWorkoutEntry(data: {
  userId: string;
  exerciseId: string;
  performedAt: Date;
}): Promise<WorkoutEntry> {
  const repo = workoutEntryRepo();
  const entry = repo.create({ id: uuidv4(), ...data });
  return repo.save(entry);
}

export async function countWorkoutEntries(): Promise<number> {
  return workoutEntryRepo().count();
}
