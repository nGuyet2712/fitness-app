import { v4 as uuidv4 } from 'uuid';
import { MuscleGroup } from '@/db/entities';
import { getTestDataSource } from '../helpers/typeorm-connection';

export function muscleGroupRepo() {
  return getTestDataSource().getRepository(MuscleGroup);
}

export async function insertMuscleGroup(name: string): Promise<MuscleGroup> {
  const repo = muscleGroupRepo();
  const mg = repo.create({ id: uuidv4(), name });
  return repo.save(mg);
}

export async function countMuscleGroups(): Promise<number> {
  return muscleGroupRepo().count();
}
