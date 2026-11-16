import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Exercise } from './exercise.entity';
import { ExerciseSet } from './exercise-set.entity';

export const WORKOUT_ENTRY_UNIQUE_CONSTRAINT =
  'UQ_workout_entries_user_exercise_performed';

@Entity('workout_entries')
@Index(
  WORKOUT_ENTRY_UNIQUE_CONSTRAINT,
  ['userId', 'exerciseId', 'performedAt'],
  { unique: true },
)
export class WorkoutEntry {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  exerciseId: string;

  @ManyToOne(() => Exercise, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'exerciseId' })
  exercise: Relation<Exercise>;

  @Column({ type: 'timestamptz' })
  performedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => ExerciseSet, (set) => set.workoutEntry, { cascade: true })
  sets: ExerciseSet[];
}
