import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExercisesRepository } from '@/components/exercises/exercises.repository';
import { ExerciseSet, WorkoutEntry } from '@/db/entities';
import { mapEntriesToValues, mapSetsToValues } from './workouts.mapper';
import { BuildRowsFn, FindHistoryParams } from './workouts.types';
import { ResolvedExercise } from '@/components/exercises/exercises.types';

@Injectable()
export class WorkoutsRepository {
  private readonly logger = new Logger(WorkoutsRepository.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly exercisesRepository: ExercisesRepository,
  ) {}

  async getWorkoutEntries(params: FindHistoryParams): Promise<WorkoutEntry[]> {
    const queryBuilder = this.dataSource
      .getRepository(WorkoutEntry)
      .createQueryBuilder('entry')
      .innerJoinAndSelect('entry.exercise', 'exercise')
      .leftJoinAndSelect('entry.sets', 'sets')
      .where('entry.userId = :userId', { userId: params.userId });

    if (params.exerciseName) {
      const escaped = params.exerciseName.replace(/[%_\\]/g, '\\$&');
      queryBuilder.andWhere('exercise.name ILIKE :exerciseName', {
        exerciseName: `%${escaped}%`,
      });
    }

    if (params.from) {
      queryBuilder.andWhere('entry.performedAt >= :from', {
        from: params.from,
      });
    }

    if (params.to) {
      queryBuilder.andWhere('entry.performedAt <= :to', { to: params.to });
    }

    if (params.muscleGroup) {
      queryBuilder
        .innerJoin('exercise.muscleGroups', 'mg')
        .andWhere('LOWER(mg.name) = LOWER(:muscleGroup)', {
          muscleGroup: params.muscleGroup,
        });
    }

    if (params.cursorPerformedAt && params.cursorId) {
      queryBuilder.andWhere(
        '(entry.performedAt < :cursorPerformedAt OR (entry.performedAt = :cursorPerformedAt AND entry.id > :cursorId))',
        {
          cursorPerformedAt: params.cursorPerformedAt,
          cursorId: params.cursorId,
        },
      );
    }

    queryBuilder
      .orderBy('entry.performedAt', 'DESC')
      .addOrderBy('entry.id', 'ASC')
      .take(params.limit + 1);

    return queryBuilder.getMany();
  }

  /**
   * Resolves exercise names and inserts workout entries + sets in a single
   * transaction. The caller provides a `buildRows` callback that receives the
   * resolved exercise map and returns the rows to insert.
   *
   * On failure the transaction is rolled back and the error is re-thrown.
   *
   * @param exerciseNames - The exercise names from the request to resolve or auto-create.
   * @param buildRows - Callback that receives the resolved exercise map and returns entry/set rows to insert.
   * @returns The resolved exercise map (lowercase name → `{ id, name }`).
   */
  async bulkInsert(
    exerciseNames: string[],
    buildRows: BuildRowsFn,
  ): Promise<Map<string, ResolvedExercise>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const exerciseMap = await this.exercisesRepository.resolveOrCreate(
        exerciseNames,
        queryRunner.manager,
      );

      const { entries, sets } = buildRows(exerciseMap);

      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(WorkoutEntry)
        .values(mapEntriesToValues(entries))
        .execute();

      if (sets.length > 0) {
        await queryRunner.manager
          .createQueryBuilder()
          .insert()
          .into(ExerciseSet)
          .values(mapSetsToValues(sets))
          .execute();
      }

      await queryRunner.commitTransaction();
      return exerciseMap;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(
        `Failed to bulk insert workouts`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
