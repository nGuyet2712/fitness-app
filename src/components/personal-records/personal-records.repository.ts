import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExerciseSet } from '@/db/entities';
import { FindSetRowsParams, SetRow } from './personal-records.types';

@Injectable()
export class PersonalRecordsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findSetRows(params: FindSetRowsParams): Promise<SetRow[]> {
    const queryBuilder = this.dataSource
      .getRepository(ExerciseSet)
      .createQueryBuilder('s')
      .innerJoin('s.workoutEntry', 'e')
      .select('s."weightKg"', 'weightKg')
      .addSelect('s.reps', 'reps')
      .addSelect('e."performedAt"', 'performedAt')
      .where('e."userId" = :userId', { userId: params.userId })
      .andWhere('e."exerciseId" = :exerciseId', {
        exerciseId: params.exerciseId,
      });

    if (params.from) {
      queryBuilder.andWhere('e."performedAt" >= :from', { from: params.from });
    }
    if (params.to) {
      queryBuilder.andWhere('e."performedAt" <= :to', { to: params.to });
    }

    const raw: { weightKg: string; reps: number; performedAt: Date }[] =
      await queryBuilder.getRawMany();

    return raw.map((r) => ({
      weightKg: Number(r.weightKg),
      reps: r.reps,
      performedAt: new Date(r.performedAt),
    }));
  }
}
