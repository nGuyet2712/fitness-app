import { v4 as uuidv4 } from 'uuid';

export function mapExercisesToValues(
  names: string[],
): { id: string; name: string }[] {
  return names.map((name) => ({ id: uuidv4(), name }));
}
