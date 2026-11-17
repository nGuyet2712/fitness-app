import { ExerciseSet } from '../../src/db/entities';
import { getTestDataSource } from '../helpers/typeorm-connection';

export function exerciseSetRepo() {
  return getTestDataSource().getRepository(ExerciseSet);
}

export async function countExerciseSets(): Promise<number> {
  return exerciseSetRepo().count();
}
