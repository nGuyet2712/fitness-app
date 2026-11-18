import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { Exercise } from '@/db/entities';
import { mapExercisesToValues } from './exercises.mapper';
import { ResolvedExercise } from './exercises.types';

@Injectable()
export class ExercisesRepository {
  private readonly logger = new Logger(ExercisesRepository.name);

  constructor(
    @InjectRepository(Exercise)
    private readonly repo: Repository<Exercise>,
  ) {}

  async findByName(name: string): Promise<ResolvedExercise | null> {
    const row = await this.repo
      .createQueryBuilder('e')
      .select(['e.id', 'e.name'])
      .where('LOWER(e.name) = LOWER(:name)', { name })
      .getOne();
    return row ? { id: row.id, name: row.name } : null;
  }

  async resolveOrCreate(
    names: string[],
    manager: EntityManager,
  ): Promise<Map<string, ResolvedExercise>> {
    const seen = new Map<string, string>();
    for (const n of names) {
      const lower = n.toLowerCase();
      if (!seen.has(lower)) {
        seen.set(lower, n);
      }
    }
    const uniqueNames = [...seen.values()].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
    if (uniqueNames.length === 0) {
      return new Map();
    }
    const uniqueLower = uniqueNames.map((n) => n.toLowerCase());

    try {
      await manager
        .createQueryBuilder()
        .insert()
        .into(Exercise)
        .values(mapExercisesToValues(uniqueNames))
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
