import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { numericTransformer } from '../../utils/numeric-transformer';
import { WorkoutEntry } from './workout-entry.entity';
import { MAX_UNIT_NAME_LENGTH, UNIT_PRECISION, UNIT_SCALE } from '@/const/unit';

@Entity('exercise_sets')
@Index('UQ_exercise_sets_entry_order', ['workoutEntryId', 'setOrder'], {
  unique: true,
})
@Check('CHK_exercise_sets_reps_positive', '"reps" > 0')
@Check('CHK_exercise_sets_weight_non_negative', '"weight" >= 0')
@Check('CHK_exercise_sets_weight_kg_non_negative', '"weightKg" >= 0')
@Check('CHK_exercise_sets_set_order_positive', '"setOrder" >= 1')
export class ExerciseSet {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workoutEntryId: string;

  @ManyToOne(() => WorkoutEntry, (entry) => entry.sets, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workoutEntryId' })
  workoutEntry: Relation<WorkoutEntry>;

  @Column({ type: 'smallint' })
  setOrder: number;

  @Column({ type: 'integer' })
  reps: number;

  @Column({
    type: 'numeric',
    precision: UNIT_PRECISION,
    scale: UNIT_SCALE,
    transformer: numericTransformer,
  })
  weight: number;

  @Column({ type: 'varchar', length: MAX_UNIT_NAME_LENGTH })
  unit: string;

  @Column({
    type: 'numeric',
    precision: UNIT_PRECISION,
    scale: UNIT_SCALE,
    transformer: numericTransformer,
  })
  weightKg: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
