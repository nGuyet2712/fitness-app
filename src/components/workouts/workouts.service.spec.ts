import { jest } from '@jest/globals';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WORKOUT_ENTRY_UNIQUE_CONSTRAINT } from '@/db/entities';
import type { WorkoutEntry } from '@/db/entities';
import type { CreateWorkoutsDto } from './dto/create-workouts.dto';
import type { GetWorkoutsQueryDto } from './dto/get-workouts-query.dto';
import { WorkoutsService } from './workouts.service';
import { BuildRowsFn, FindHistoryParams } from './workouts.types';
import { WorkoutsRepository } from './workouts.repository';

function createMockWorkoutsRepository() {
  return {
    bulkInsert:
      jest.fn<
        (
          names: string[],
          buildRows: BuildRowsFn,
        ) => Promise<Map<string, { id: string; name: string }>>
      >(),
    getWorkoutEntries:
      jest.fn<(params: FindHistoryParams) => Promise<WorkoutEntry[]>>(),
  };
}

function validDto(overrides?: Partial<CreateWorkoutsDto>): CreateWorkoutsDto {
  return {
    userId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    entries: [
      {
        exerciseName: 'Bench Press',
        performedAt: '2026-11-17T08:30:00+07:00',
        sets: [
          { reps: 10, weight: 60, unit: 'kg' },
          { reps: 8, weight: 135, unit: 'lb' },
        ],
      },
    ],
    ...overrides,
  } as CreateWorkoutsDto;
}

function mockWorkoutEntry(overrides?: Partial<WorkoutEntry>): WorkoutEntry {
  return {
    id: 'entry-1',
    userId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    exerciseId: 'ex-1',
    exercise: {
      id: 'ex-1',
      name: 'Bench Press',
      createdAt: new Date(),
      muscleGroups: [],
    },
    performedAt: new Date('2026-11-17T01:30:00.000Z'),
    createdAt: new Date('2026-11-17T02:00:00.000Z'),
    sets: [
      {
        id: 'set-1',
        workoutEntryId: 'entry-1',
        workoutEntry: {} as WorkoutEntry,
        setOrder: 1,
        reps: 10,
        weight: 60,
        unit: 'kg',
        weightKg: 60,
        createdAt: new Date(),
      },
    ],
    ...overrides,
  } as WorkoutEntry;
}

describe('WorkoutsService', () => {
  let service: WorkoutsService;
  let mockRepo: ReturnType<typeof createMockWorkoutsRepository>;

  beforeEach(async () => {
    mockRepo = createMockWorkoutsRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutsService,
        { provide: WorkoutsRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<WorkoutsService>(WorkoutsService);

    // Default: bulkInsert calls the buildRows callback and returns the map.
    mockRepo.bulkInsert.mockImplementation(async (_names, buildRows) => {
      const exerciseMap = new Map([
        ['bench press', { id: 'ex-1', name: 'Bench Press' }],
      ]);
      buildRows(exerciseMap);
      return exerciseMap;
    });
  });

  describe('bulkCreate', () => {
    it('should normalise weightKg using toKg', async () => {
      const result = await service.bulkCreate(validDto());

      expect(result[0].sets[0].weightKg).toBe(60);
      expect(result[0].sets[1].weightKg).toBe(61.235);
    });

    it('should assign setOrder starting at 1 in array order', async () => {
      const result = await service.bulkCreate(validDto());

      expect(result[0].sets.map((s) => s.setOrder)).toEqual([1, 2]);
    });

    it('should return entries in request order', async () => {
      mockRepo.bulkInsert.mockImplementation(async (_names, buildRows) => {
        const exerciseMap = new Map([
          ['bench press', { id: 'ex-1', name: 'Bench Press' }],
          ['squat', { id: 'ex-2', name: 'Squat' }],
        ]);
        buildRows(exerciseMap);
        return exerciseMap;
      });

      const dto = validDto({
        entries: [
          {
            exerciseName: 'Squat',
            performedAt: '2026-11-17T09:00:00Z',
            sets: [{ reps: 5, weight: 100, unit: 'kg' }],
          },
          {
            exerciseName: 'Bench Press',
            performedAt: '2026-11-17T08:30:00Z',
            sets: [{ reps: 10, weight: 60, unit: 'kg' }],
          },
        ],
      } as Partial<CreateWorkoutsDto>);

      const result = await service.bulkCreate(dto);

      expect(result[0].exerciseName).toBe('Squat');
      expect(result[1].exerciseName).toBe('Bench Press');
    });

    it('should return the stored exercise name, not the input casing', async () => {
      const dto = validDto({
        entries: [
          {
            exerciseName: 'bench press',
            performedAt: '2026-11-17T08:30:00Z',
            sets: [{ reps: 5, weight: 60, unit: 'kg' }],
          },
        ],
      } as Partial<CreateWorkoutsDto>);

      const result = await service.bulkCreate(dto);

      expect(result[0].exerciseName).toBe('Bench Press');
    });

    it('should sort entries by exerciseId then performedAt in buildRows', async () => {
      let capturedEntries: { exerciseId: string; performedAt: Date }[] = [];

      mockRepo.bulkInsert.mockImplementation(async (_names, buildRows) => {
        const exerciseMap = new Map([
          ['squat', { id: 'ex-2', name: 'Squat' }],
          ['bench press', { id: 'ex-1', name: 'Bench Press' }],
        ]);
        const { entries } = buildRows(exerciseMap);
        capturedEntries = entries;
        return exerciseMap;
      });

      const dto = validDto({
        entries: [
          {
            exerciseName: 'Squat',
            performedAt: '2026-11-17T09:00:00Z',
            sets: [{ reps: 5, weight: 100, unit: 'kg' }],
          },
          {
            exerciseName: 'Bench Press',
            performedAt: '2026-11-17T08:30:00Z',
            sets: [{ reps: 10, weight: 60, unit: 'kg' }],
          },
        ],
      } as Partial<CreateWorkoutsDto>);

      await service.bulkCreate(dto);

      // ex-1 (Bench Press) should come before ex-2 (Squat)
      expect(capturedEntries[0].exerciseId).toBe('ex-1');
      expect(capturedEntries[1].exerciseId).toBe('ex-2');
    });

    it('should throw BadRequestException when two entries share exerciseName and performedAt', async () => {
      const dto = validDto({
        entries: [
          {
            exerciseName: 'Bench Press',
            performedAt: '2026-11-17T08:30:00Z',
            sets: [{ reps: 10, weight: 60, unit: 'kg' }],
          },
          {
            exerciseName: 'bench press',
            performedAt: '2026-11-17T08:30:00Z',
            sets: [{ reps: 5, weight: 80, unit: 'kg' }],
          },
        ],
      } as Partial<CreateWorkoutsDto>);

      await expect(service.bulkCreate(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should detect duplicates across different timezone offsets for the same instant', async () => {
      const dto = validDto({
        entries: [
          {
            exerciseName: 'Bench Press',
            performedAt: '2026-11-17T10:00:00Z',
            sets: [{ reps: 10, weight: 60, unit: 'kg' }],
          },
          {
            exerciseName: 'Bench Press',
            performedAt: '2026-11-17T17:00:00+07:00',
            sets: [{ reps: 5, weight: 80, unit: 'kg' }],
          },
        ],
      } as Partial<CreateWorkoutsDto>);

      await expect(service.bulkCreate(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not call bulkInsert when the duplicate check fails', async () => {
      const dto = validDto({
        entries: [
          {
            exerciseName: 'Bench Press',
            performedAt: '2026-11-17T08:30:00Z',
            sets: [{ reps: 10, weight: 60, unit: 'kg' }],
          },
          {
            exerciseName: 'bench press',
            performedAt: '2026-11-17T08:30:00Z',
            sets: [{ reps: 5, weight: 80, unit: 'kg' }],
          },
        ],
      } as Partial<CreateWorkoutsDto>);

      await expect(service.bulkCreate(dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepo.bulkInsert).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when the duplicate-entry constraint is violated', async () => {
      const pgError = new Error('duplicate key value') as Error & {
        driverError: { code: string; constraint: string };
      };
      pgError.driverError = {
        code: '23505',
        constraint: WORKOUT_ENTRY_UNIQUE_CONSTRAINT,
      };

      mockRepo.bulkInsert.mockRejectedValue(pgError);

      await expect(service.bulkCreate(validDto())).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rethrow 23505 on a different constraint', async () => {
      const pgError = new Error('duplicate key value') as Error & {
        driverError: { code: string; constraint: string };
      };
      pgError.driverError = {
        code: '23505',
        constraint: 'some_other_constraint',
      };

      mockRepo.bulkInsert.mockRejectedValue(pgError);

      await expect(service.bulkCreate(validDto())).rejects.toThrow(pgError);
    });

    it('should rethrow unexpected errors from the repository', async () => {
      mockRepo.bulkInsert.mockRejectedValue(new Error('connection lost'));

      await expect(service.bulkCreate(validDto())).rejects.toThrow(
        'connection lost',
      );
    });
  });

  describe('getWorkouts', () => {
    const baseQuery: GetWorkoutsQueryDto = {
      userId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    };

    beforeEach(() => {
      mockRepo.getWorkoutEntries.mockResolvedValue([]);
    });

    it('should return entries from the repository', async () => {
      mockRepo.getWorkoutEntries.mockResolvedValue([mockWorkoutEntry()]);

      const result = await service.getWorkouts(baseQuery);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].exerciseName).toBe('Bench Press');
      expect(result.data[0].performedAt).toBe('2026-11-17T01:30:00.000Z');
    });

    it('should default unit to kg', async () => {
      mockRepo.getWorkoutEntries.mockResolvedValue([mockWorkoutEntry()]);

      const result = await service.getWorkouts(baseQuery);

      expect(result.data[0].sets[0].weight).toBe(60);
      expect(result.data[0].sets[0].unit).toBe('kg');
      expect(result.data[0].sets[0].weightKg).toBe(60);
    });

    it('should convert weightKg to the requested unit', async () => {
      mockRepo.getWorkoutEntries.mockResolvedValue([mockWorkoutEntry()]);

      const result = await service.getWorkouts({ ...baseQuery, unit: 'lb' });

      expect(result.data[0].sets[0].weight).toBe(132.277);
      expect(result.data[0].sets[0].unit).toBe('lb');
      expect(result.data[0].sets[0].weightKg).toBe(60);
    });

    it('should pass filters to the repository', async () => {
      await service.getWorkouts({
        ...baseQuery,
        exerciseName: 'Bench',
        muscleGroup: 'Chest',
        from: '2026-11-01T00:00:00Z',
        to: '2026-11-30T23:59:59Z',
      });

      expect(mockRepo.getWorkoutEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: baseQuery.userId,
          exerciseName: 'Bench',
          muscleGroup: 'Chest',
          from: '2026-11-01T00:00:00Z',
          to: '2026-11-30T23:59:59Z',
        }),
      );
    });

    it('should return null cursor when no more pages', async () => {
      mockRepo.getWorkoutEntries.mockResolvedValue([mockWorkoutEntry()]);

      const result = await service.getWorkouts({ ...baseQuery, limit: 10 });

      expect(result.pagination.cursor).toBeNull();
      expect(result.pagination.limit).toBe(10);
    });

    it('should return a cursor when there are more pages', async () => {
      const entries = [
        mockWorkoutEntry({
          id: 'e1',
          performedAt: new Date('2026-11-17T10:00:00Z'),
        }),
        mockWorkoutEntry({
          id: 'e2',
          performedAt: new Date('2026-11-17T09:00:00Z'),
        }),
        mockWorkoutEntry({
          id: 'e3',
          performedAt: new Date('2026-11-17T08:00:00Z'),
        }),
      ];
      mockRepo.getWorkoutEntries.mockResolvedValue(entries);

      const result = await service.getWorkouts({ ...baseQuery, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.cursor).toBeTruthy();
    });

    it('should throw BadRequestException for malformed cursor', async () => {
      await expect(
        service.getWorkouts({ ...baseQuery, cursor: 'not-valid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when cursor is missing required fields', async () => {
      const badCursor = Buffer.from(JSON.stringify({ foo: 'bar' })).toString(
        'base64url',
      );

      await expect(
        service.getWorkouts({ ...baseQuery, cursor: badCursor }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should sort sets by setOrder', async () => {
      const entry = mockWorkoutEntry();
      entry.sets = [
        { ...entry.sets[0], id: 's2', setOrder: 2 },
        { ...entry.sets[0], id: 's1', setOrder: 1 },
        { ...entry.sets[0], id: 's3', setOrder: 3 },
      ];
      mockRepo.getWorkoutEntries.mockResolvedValue([entry]);

      const result = await service.getWorkouts(baseQuery);

      expect(result.data[0].sets.map((s) => s.setOrder)).toEqual([1, 2, 3]);
    });
  });
});
