import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { Exercise } from '@/db/entities';
import { mapExercisesToValues } from './exercises.mapper';

export interface ResolvedExercise {
  id: string;
  name: string;
}

@Injectable()
export class ExercisesRepository {
  private readonly logger = new Logger(ExercisesRepository.name);

  constructor(
    @InjectRepository(Exercise)
    private readonly repo: Repository<Exercise>,
  ) {}

  /**
   * Resolve one or more exercise names to their rows, creating any that don't
   * exist. Names are matched case-insensitively; the returned `name` is the
   * stored (first-inserted) casing.
   *
   * The caller passes every name in the request at once so this costs 2 queries
   * instead of 2 per entry. Deduplicates and sorts names to avoid deadlocks.
   *
   * @returns Map keyed by **lowercased** name → `{ id, name }`.
   */
  async resolveOrCreate(
    names: string[],
    manager: EntityManager,
  ): Promise<Map<string, ResolvedExercise>> {
    const uniqueLower = [...new Set(names.map((n) => n.toLowerCase()))].sort();
    if (uniqueLower.length === 0) {
      return new Map();
    }

    try {
      await manager
        .createQueryBuilder()
        .insert()
        .into(Exercise)
        .values(mapExercisesToValues(uniqueLower))
        .orIgnore()
        .execute();

      const rows: Pick<Exercise, 'id' | 'name'>[] = await manager
        .createQueryBuilder(Exercise, 'e')
        .select(['e.id', 'e.name'])
        .where('LOWER(e.name) IN (:...names)', { names: uniqueLower })
        .getMany();

      const result = new Map<string, ResolvedExercise>();
      for (const row of rows) {
        result.set(row.name.toLowerCase(), { id: row.id, name: row.name });
      }
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to resolve exercises: ${uniqueLower.join(', ')}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
