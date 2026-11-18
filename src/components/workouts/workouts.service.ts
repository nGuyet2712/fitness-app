import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_LIMIT } from '../../const/workout';
import { WORKOUT_ENTRY_UNIQUE_CONSTRAINT } from '../../db/entities';
import { decodeCursor, encodeCursor } from '../../utils/cursor';
import { fromKg, toKg } from '../../utils/unit-conversion';
import type {
  CreateEntryDto,
  CreateWorkoutsDto,
} from './dto/create-workouts.dto';
import type { GetWorkoutsQueryDto } from './dto/get-workouts-query.dto';
import { WorkoutsRepository } from './workouts.repository';
import type {
  CreatedWorkoutEntry,
  InsertEntryRow,
  InsertSetRow,
  PgDriverError,
  WorkoutHistoryResponse,
} from './workouts.types';
import { SUPPORTED_UNITS } from '@/const/unit';

@Injectable()
export class WorkoutsService {
  private readonly logger = new Logger(WorkoutsService.name);

  constructor(private readonly workoutsRepository: WorkoutsRepository) {}

  async getWorkouts(
    query: GetWorkoutsQueryDto,
  ): Promise<WorkoutHistoryResponse> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const unit = query.unit ?? SUPPORTED_UNITS[0]; // 'kg'

    let cursorPerformedAt: string | undefined;
    let cursorId: string | undefined;

    if (query.cursor) {
      try {
        const decoded = decodeCursor(query.cursor);
        if (
          typeof decoded.performedAt !== 'string' ||
          typeof decoded.id !== 'string'
        ) {
          throw new Error('Invalid cursor shape');
        }
        cursorPerformedAt = decoded.performedAt;
        cursorId = decoded.id;
      } catch {
        throw new BadRequestException('Malformed cursor');
      }
    }

    const entries = await this.workoutsRepository.getWorkoutEntries({
      userId: query.userId,
      exerciseName: query.exerciseName,
      muscleGroup: query.muscleGroup,
      from: query.from,
      to: query.to,
      cursorPerformedAt,
      cursorId,
      limit,
    });

    const hasNextPage = entries.length > limit;
    const page = hasNextPage ? entries.slice(0, limit) : entries;

    let nextCursor: string | null = null;
    if (hasNextPage) {
      const last = page[page.length - 1];
      nextCursor = encodeCursor({
        performedAt: last.performedAt.toISOString(),
        id: last.id,
      });
    }

    return {
      data: page.map((entry) => ({
        id: entry.id,
        userId: entry.userId,
        exerciseName: entry.exercise.name,
        performedAt: entry.performedAt.toISOString(),
        createdAt: entry.createdAt.toISOString(),
        sets: [...entry.sets]
          .sort((a, b) => a.setOrder - b.setOrder)
          .map((s) => ({
            id: s.id,
            setOrder: s.setOrder,
            reps: s.reps,
            weight: fromKg(s.weightKg, unit),
            unit,
            weightKg: s.weightKg,
          })),
      })),
      pagination: {
        limit,
        cursor: nextCursor,
      },
    };
  }

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
