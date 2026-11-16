import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryColumn,
} from 'typeorm';
import { MuscleGroup } from './muscle-group.entity';
import { MAX_NAME_LENGTH } from '@/const/workout';

@Entity('exercises')
@Index('UQ_exercises_name_lower', { synchronize: false })
export class Exercise {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: MAX_NAME_LENGTH })
  name: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToMany(() => MuscleGroup)
  @JoinTable({
    name: 'exercise_muscle_groups',
    joinColumn: { name: 'exerciseId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'muscleGroupId', referencedColumnName: 'id' },
  })
  muscleGroups: MuscleGroup[];
}
