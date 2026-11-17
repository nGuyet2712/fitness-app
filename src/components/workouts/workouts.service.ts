import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { WORKOUT_ENTRY_UNIQUE_CONSTRAINT } from '../../db/entities';
import { toKg } from '../../utils/unit-conversion';
import type {
  CreateEntryDto,
  CreateWorkoutsDto,
} from './dto/create-workouts.dto';
import { WorkoutsRepository } from './workouts.repository';
import type {
  CreatedWorkoutEntry,
  InsertEntryRow,
  InsertSetRow,
  PgDriverError,
} from './workouts.types';

@Injectable()
export class WorkoutsService {
  private readonly logger = new Logger(WorkoutsService.name);

  constructor(private readonly workoutsRepository: WorkoutsRepository) {}

  async bulkCreate(dto: CreateWorkoutsDto): Promise<CreatedWorkoutEntry[]> {
    const { userId, entries } = dto;

    // ── 1. Check for in-payload duplicates ──────────────────────────────
    this.checkInPayloadDuplicates(entries);

    // ── 2. Pre-build IDs and computed fields ────────────────────────────
    const preBuiltEntries = entries.map((entry) => {
      const entryId = uuidv4();
      return {
        entryId,
        exerciseName: entry.exerciseName,
        performedAt: new Date(entry.performedAt),
        sets: entry.sets.map((s, i) => ({
          id: uuidv4(),
          workoutEntryId: entryId,
          setOrder: i + 1,
          reps: s.reps,
          weight: s.weight,
          unit: s.unit,
          weightKg: toKg(s.weight, s.unit),
        })),
      };
    });

    // ── 3. Resolve exercises + insert in a single transaction ───────────
    const exerciseNames = entries.map((e) => e.exerciseName);

    try {
      const exerciseMap = await this.workoutsRepository.bulkInsert(
        exerciseNames,
        (exMap) => {
          const entryRows: InsertEntryRow[] = [];
          const setRows: InsertSetRow[] = [];

          for (const entry of preBuiltEntries) {
            const resolved = exMap.get(entry.exerciseName.toLowerCase())!;
            entryRows.push({
              id: entry.entryId,
              userId,
              exerciseId: resolved.id,
              performedAt: entry.performedAt,
            });
            setRows.push(...entry.sets);
          }

          // Sort entries to avoid deadlocks from multiple current requests inserting the same exercise names in different orders
          entryRows.sort((a, b) => {
            const cmp = a.exerciseId.localeCompare(b.exerciseId);
            return cmp !== 0
              ? cmp
              : a.performedAt.getTime() - b.performedAt.getTime();
          });

          return { entries: entryRows, sets: setRows };
        },
      );

      // ── 4. Build response in request order ────────────────────────────
      this.logger.log(`Logged ${entries.length} entries for user ${userId}`);

      const now = new Date().toISOString();
      return preBuiltEntries.map((p) => {
        const resolved = exerciseMap.get(p.exerciseName.toLowerCase())!;
        return {
          id: p.entryId,
          userId,
          exerciseName: resolved.name,
          performedAt: p.performedAt.toISOString(),
          createdAt: now,
          sets: p.sets.map((s) => ({
            id: s.id,
            setOrder: s.setOrder,
            reps: s.reps,
            weight: s.weight,
            unit: s.unit,
            weightKg: s.weightKg,
          })),
        };
      });
    } catch (error: unknown) {
      const driverError = (error as { driverError?: PgDriverError })
        ?.driverError;
      if (
        driverError?.code === '23505' &&
        driverError?.constraint === WORKOUT_ENTRY_UNIQUE_CONSTRAINT
      ) {
        throw new ConflictException(
          'A workout entry for this user, exercise and performedAt already exists',
        );
      }
      throw error;
    }
  }

  /**
   * Reject a request that contains the same (exerciseName, performedAt) pair
   * more than once. The check runs before any database work.
   *
   * @param entries - The array of entries from the request body.
   * @throws {BadRequestException} If two entries share the same exerciseName and performedAt.
   */
  private checkInPayloadDuplicates(entries: CreateEntryDto[]): void {
    const seen = new Map<string, number>();
    for (const [i, entry] of entries.entries()) {
      const instant = new Date(entry.performedAt).getTime();
      const key = `${entry.exerciseName.toLowerCase()}|${instant}`;
      const prev = seen.get(key);
      if (prev !== undefined) {
        throw new BadRequestException(
          `entries.${i} duplicates entries.${prev} (same exerciseName and performedAt)`,
        );
      }
      seen.set(key, i);
    }
  }
}
