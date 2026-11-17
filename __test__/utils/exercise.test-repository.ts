import { v4 as uuidv4 } from 'uuid';
import { Exercise } from '../../src/db/entities';
import { getTestDataSource } from '../helpers/typeorm-connection';

export function exerciseRepo() {
  return getTestDataSource().getRepository(Exercise);
}

export async function insertExercise(name: string): Promise<Exercise> {
  const repo = exerciseRepo();
  const exercise = repo.create({ id: uuidv4(), name });
  return repo.save(exercise);
}

export async function countExercises(): Promise<number> {
  return exerciseRepo().count();
}

export async function findExerciseByName(
  name: string,
): Promise<Exercise | null> {
  return exerciseRepo()
    .createQueryBuilder('e')
    .where('LOWER(e.name) = LOWER(:name)', { name })
    .getOne();
}
