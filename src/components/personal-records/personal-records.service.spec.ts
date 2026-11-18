import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExercisesRepository } from '@/components/exercises/exercises.repository';
import { PersonalRecordsService } from './personal-records.service';
import { PersonalRecordsRepository } from './personal-records.repository';
import type { GetPersonalRecordsQueryDto } from './dto/get-personal-records-query.dto';
import { ResolvedExercise } from '@/components/exercises/exercises.types';
import { FindSetRowsParams, SetRow } from './personal-records.types';

function createMockExercisesRepository() {
  return {
    findByName: jest.fn<(name: string) => Promise<ResolvedExercise | null>>(),
    resolveOrCreate: jest.fn(),
  };
}

function createMockPrRepository(rows: SetRow[] = []) {
  return {
    findSetRows: jest
      .fn<(params: FindSetRowsParams) => Promise<SetRow[]>>()
      .mockResolvedValue(rows),
  };
}

const BASE_QUERY: GetPersonalRecordsQueryDto = {
  userId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  exerciseName: 'Bench Press',
};

describe('PersonalRecordsService', () => {
  let service: PersonalRecordsService;
  let mockExercisesRepo: ReturnType<typeof createMockExercisesRepository>;
  let mockPrRepo: ReturnType<typeof createMockPrRepository>;

  beforeEach(async () => {
    mockExercisesRepo = createMockExercisesRepository();
    mockPrRepo = createMockPrRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalRecordsService,
        { provide: PersonalRecordsRepository, useValue: mockPrRepo },
        { provide: ExercisesRepository, useValue: mockExercisesRepo },
      ],
    }).compile();

    service = module.get<PersonalRecordsService>(PersonalRecordsService);
  });

  it('should throw BadRequestException when exercise name is unknown', async () => {
    mockExercisesRepo.findByName.mockResolvedValue(null);

    await expect(service.getPersonalRecords(BASE_QUERY)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should return null PRs when no sets exist', async () => {
    mockExercisesRepo.findByName.mockResolvedValue({
      id: 'ex-1',
      name: 'Bench Press',
    });

    const result = await service.getPersonalRecords(BASE_QUERY);

    expect(result.data.current.heaviestSet).toBeNull();
    expect(result.data.current.highestVolume).toBeNull();
    expect(result.data.current.bestEstimated1RM).toBeNull();
    expect(result.data.previous).toBeNull();
  });

  it('should compute PRs from set data', async () => {
    mockExercisesRepo.findByName.mockResolvedValue({
      id: 'ex-1',
      name: 'Bench Press',
    });
    mockPrRepo.findSetRows.mockResolvedValue([
      { weightKg: 100, reps: 3, performedAt: new Date('2026-11-16T08:00:00Z') },
      { weightKg: 80, reps: 8, performedAt: new Date('2026-11-17T08:00:00Z') },
    ]);

    const result = await service.getPersonalRecords(BASE_QUERY);

    expect(result.data.exerciseName).toBe('Bench Press');
    expect(result.data.current.heaviestSet?.value).toBe(100);
    expect(result.data.current.highestVolume?.value).toBe(640);
    expect(result.data.current.bestEstimated1RM).not.toBeNull();
  });

  it('should convert PR values to the requested unit', async () => {
    mockExercisesRepo.findByName.mockResolvedValue({
      id: 'ex-1',
      name: 'Bench Press',
    });
    mockPrRepo.findSetRows.mockResolvedValue([
      { weightKg: 100, reps: 1, performedAt: new Date('2026-11-16T08:00:00Z') },
    ]);

    const result = await service.getPersonalRecords({
      ...BASE_QUERY,
      unit: 'lb',
    });

    expect(result.data.unit).toBe('lb');
    expect(result.data.current.heaviestSet?.value).toBe(220.462);
  });

  it('should return previous PRs when comparison params are provided', async () => {
    mockExercisesRepo.findByName.mockResolvedValue({
      id: 'ex-1',
      name: 'Bench Press',
    });
    mockPrRepo.findSetRows
      .mockResolvedValueOnce([
        {
          weightKg: 100,
          reps: 5,
          performedAt: new Date('2026-11-15T08:00:00Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          weightKg: 60,
          reps: 10,
          performedAt: new Date('2026-10-15T08:00:00Z'),
        },
      ]);

    const result = await service.getPersonalRecords({
      ...BASE_QUERY,
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-30T23:59:59Z',
      compareFrom: '2026-10-01T00:00:00Z',
      compareTo: '2026-10-31T23:59:59Z',
    });

    expect(result.data.current.heaviestSet?.value).toBe(100);
    expect(result.data.previous).not.toBeNull();
    expect(result.data.previous?.heaviestSet?.value).toBe(60);
    expect(mockPrRepo.findSetRows).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-11-01T00:00:00Z',
        to: '2026-11-30T23:59:59Z',
      }),
    );
    expect(mockPrRepo.findSetRows).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-31T23:59:59Z',
      }),
    );
  });
});
