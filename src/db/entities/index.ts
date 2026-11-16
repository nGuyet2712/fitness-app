export { Exercise } from './exercise.entity';
export { ExerciseSet } from './exercise-set.entity';
export { MuscleGroup } from './muscle-group.entity';
export {
  WorkoutEntry,
  WORKOUT_ENTRY_UNIQUE_CONSTRAINT,
} from './workout-entry.entity';

import { Exercise } from './exercise.entity';
import { ExerciseSet } from './exercise-set.entity';
import { MuscleGroup } from './muscle-group.entity';
import { WorkoutEntry } from './workout-entry.entity';

export const allEntities: (new () => object)[] = [
  Exercise,
  MuscleGroup,
  WorkoutEntry,
  ExerciseSet,
];
