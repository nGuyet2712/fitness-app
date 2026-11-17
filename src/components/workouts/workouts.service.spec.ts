import { jest } from '@jest/globals';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WORKOUT_ENTRY_UNIQUE_CONSTRAINT } from '../../db/entities';
import type { CreateWorkoutsDto } from './dto/create-workouts.dto';
import { WorkoutsService } from './workouts.service';
import { BuildRowsFn } from './workouts.types';
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
});
