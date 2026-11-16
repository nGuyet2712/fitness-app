import { MAX_NAME_LENGTH } from '@/const/workout';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('muscle_groups')
@Index('UQ_muscle_groups_name_lower', { synchronize: false })
export class MuscleGroup {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: MAX_NAME_LENGTH })
  name: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
