import { HttpStatus } from '@nestjs/common';
import { api } from '../helpers/http-client';
import {
  cleanAllTables,
  connectTestDb,
  disconnectTestDb,
} from '../helpers/typeorm-connection';
import {
  insertExercise,
  linkExerciseToMuscleGroup,
} from '../utils/exercise.test-repository';
import { insertExerciseSet } from '../utils/exercise-set.test-repository';
import { insertMuscleGroup } from '../utils/muscle-group.test-repository';
import { insertWorkoutEntry } from '../utils/workout-entry.test-repository';

const ENDPOINT = '/workouts';
const USER_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

async function seedStandardData() {
  const chest = await insertMuscleGroup('Chest');
  const legs = await insertMuscleGroup('Legs');

  const bench = await insertExercise('Bench Press');
  await linkExerciseToMuscleGroup(bench.id, chest.id);

  const squat = await insertExercise('Squat');
  await linkExerciseToMuscleGroup(squat.id, legs.id);

  const deadlift = await insertExercise('Deadlift');

  const entry1 = await insertWorkoutEntry({
    userId: USER_ID,
    exerciseId: bench.id,
    performedAt: new Date('2026-11-15T08:00:00Z'),
  });
  await insertExerciseSet({
    workoutEntryId: entry1.id,
    setOrder: 1,
    reps: 10,
    weight: 60,
    unit: 'kg',
    weightKg: 60,
  });

  const entry2 = await insertWorkoutEntry({
    userId: USER_ID,
    exerciseId: bench.id,
    performedAt: new Date('2026-11-17T08:00:00Z'),
  });
  await insertExerciseSet({
    workoutEntryId: entry2.id,
    setOrder: 1,
    reps: 8,
    weight: 80,
    unit: 'kg',
    weightKg: 80,
  });

  const entry3 = await insertWorkoutEntry({
    userId: USER_ID,
    exerciseId: squat.id,
    performedAt: new Date('2026-11-16T10:00:00Z'),
  });
  await insertExerciseSet({
    workoutEntryId: entry3.id,
    setOrder: 1,
    reps: 5,
    weight: 100,
    unit: 'kg',
    weightKg: 100,
  });

  const entry4 = await insertWorkoutEntry({
    userId: USER_ID,
    exerciseId: deadlift.id,
    performedAt: new Date('2026-11-14T07:00:00Z'),
  });
  await insertExerciseSet({
    workoutEntryId: entry4.id,
    setOrder: 1,
    reps: 3,
    weight: 150,
    unit: 'lb',
    weightKg: 68.039,
  });

  return {
    bench,
    squat,
    deadlift,
    chest,
    legs,
    entry1,
    entry2,
    entry3,
    entry4,
  };
}

beforeAll(async () => {
  await connectTestDb();
});

beforeEach(async () => {
  await cleanAllTables();
});

afterAll(async () => {
  await cleanAllTables();
  await disconnectTestDb();
});

describe('GET /workouts', () => {
  describe('basic retrieval', () => {
    it('should return 200 with correct shape, entries ordered by performedAt desc by default, and sets ordered by setOrder', async () => {
      const { entry2 } = await seedStandardData();
      await insertExerciseSet({
        workoutEntryId: entry2.id,
        setOrder: 2,
        reps: 6,
        weight: 85,
        unit: 'kg',
        weightKg: 85,
      });

      const res = await api().get(ENDPOINT).query({ userId: USER_ID });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toHaveLength(4);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.cursor).toBeNull();

      // Entries ordered by performedAt descending
      const dates = res.body.data.map(
        (e: { performedAt: string }) => e.performedAt,
      );
      for (let i = 1; i < dates.length; i++) {
        expect(new Date(dates[i - 1]).getTime()).toBeGreaterThanOrEqual(
          new Date(dates[i]).getTime(),
        );
      }

      // Sets ordered by setOrder (entry2 has 2 sets: setOrder 1 and 2)
      const firstEntry = res.body.data[0];
      expect(firstEntry.sets).toHaveLength(2);
      expect(firstEntry.sets[0].setOrder).toBe(1);
      expect(firstEntry.sets[1].setOrder).toBe(2);

      // Response shape
      expect(firstEntry).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          userId: USER_ID,
          exerciseName: 'Bench Press',
          performedAt: expect.any(String),
          createdAt: expect.any(String),
        }),
      );
      expect(firstEntry.sets[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          setOrder: 1,
          reps: 8,
          weight: 80,
          unit: 'kg',
          weightKg: 80,
        }),
      );
    });

    it('should return empty data array when no entries exist for the user', async () => {
      await seedStandardData();

      const res = await api()
        .get(ENDPOINT)
        .query({ userId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.cursor).toBeNull();
    });
  });

  describe('filtering by exercise name', () => {
    it('should filter by partial exercise name (case-insensitive)', async () => {
      await seedStandardData();

      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, exerciseName: 'bench' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toHaveLength(2);
      for (const entry of res.body.data) {
        expect(entry.exerciseName.toLowerCase()).toContain('bench');
      }
    });

    it('should return empty when exercise name does not match', async () => {
      await seedStandardData();

      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, exerciseName: 'Nonexistent' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toEqual([]);
    });

    it('should treat ILIKE wildcards in exerciseName as literal characters', async () => {
      const exercise = await insertExercise('100% Effort');
      await insertWorkoutEntry({
        userId: USER_ID,
        exerciseId: exercise.id,
        performedAt: new Date('2026-11-17T08:00:00Z'),
      });

      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, exerciseName: '100%' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].exerciseName).toBe('100% Effort');
    });
  });

  describe('filtering by date range', () => {
    it('should filter entries within the date range', async () => {
      await seedStandardData();

      const res = await api().get(ENDPOINT).query({
        userId: USER_ID,
        from: '2026-11-15T00:00:00Z',
        to: '2026-11-16T23:59:59Z',
      });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter with only from', async () => {
      await seedStandardData();

      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, from: '2026-11-17T00:00:00Z' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].exerciseName).toBe('Bench Press');
    });

    it('should filter with only to', async () => {
      await seedStandardData();

      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, to: '2026-11-14T23:59:59Z' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].exerciseName).toBe('Deadlift');
    });
  });

  describe('filtering by muscle group', () => {
    it('should filter entries by muscle group', async () => {
      await seedStandardData();

      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, muscleGroup: 'Chest' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toHaveLength(2);
      for (const entry of res.body.data) {
        expect(entry.exerciseName).toBe('Bench Press');
      }
    });

    it('should be case-insensitive for muscle group name', async () => {
      await seedStandardData();

      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, muscleGroup: 'cHEst' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty when muscle group has no matching exercises', async () => {
      await seedStandardData();

      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, muscleGroup: 'Arms' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toEqual([]);
    });

    it('should not return exercises that have no muscle group when filtering', async () => {
      await seedStandardData();

      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, muscleGroup: 'Legs' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].exerciseName).toBe('Squat');
    });
  });

  describe('unit conversion', () => {
    it('should convert weights to the requested unit', async () => {
      const exercise = await insertExercise('Bench Press');
      const entry = await insertWorkoutEntry({
        userId: USER_ID,
        exerciseId: exercise.id,
        performedAt: new Date('2026-11-17T08:00:00Z'),
      });
      await insertExerciseSet({
        workoutEntryId: entry.id,
        setOrder: 1,
        reps: 10,
        weight: 60,
        unit: 'kg',
        weightKg: 60,
      });

      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, unit: 'lb' });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data[0].sets[0].weight).toBe(132.277);
      expect(res.body.data[0].sets[0].unit).toBe('lb');
      expect(res.body.data[0].sets[0].weightKg).toBe(60);
    });

    it('should default to kg when unit is not specified', async () => {
      const exercise = await insertExercise('Bench Press');
      const entry = await insertWorkoutEntry({
        userId: USER_ID,
        exerciseId: exercise.id,
        performedAt: new Date('2026-11-17T08:00:00Z'),
      });
      await insertExerciseSet({
        workoutEntryId: entry.id,
        setOrder: 1,
        reps: 10,
        weight: 60,
        unit: 'kg',
        weightKg: 60,
      });

      const res = await api().get(ENDPOINT).query({ userId: USER_ID });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data[0].sets[0].weight).toBe(60);
      expect(res.body.data[0].sets[0].unit).toBe('kg');
    });
  });

  describe('cursor-based pagination', () => {
    it('should paginate through results using cursor', async () => {
      const exercise = await insertExercise('Bench Press');
      for (let i = 0; i < 5; i++) {
        const entry = await insertWorkoutEntry({
          userId: USER_ID,
          exerciseId: exercise.id,
          performedAt: new Date(`2026-11-${15 + i}T08:00:00Z`),
        });
        await insertExerciseSet({
          workoutEntryId: entry.id,
          setOrder: 1,
          reps: 10,
          weight: 60,
          unit: 'kg',
          weightKg: 60,
        });
      }

      // Page 1
      const page1 = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, limit: 2 });

      expect(page1.status).toBe(HttpStatus.OK);
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.pagination.cursor).toBeTruthy();

      // Page 2
      const page2 = await api().get(ENDPOINT).query({
        userId: USER_ID,
        limit: 2,
        cursor: page1.body.pagination.cursor,
      });

      expect(page2.status).toBe(HttpStatus.OK);
      expect(page2.body.data).toHaveLength(2);
      expect(page2.body.pagination.cursor).toBeTruthy();

      // Page 3 (last page)
      const page3 = await api().get(ENDPOINT).query({
        userId: USER_ID,
        limit: 2,
        cursor: page2.body.pagination.cursor,
      });

      expect(page3.status).toBe(HttpStatus.OK);
      expect(page3.body.data).toHaveLength(1);
      expect(page3.body.pagination.cursor).toBeNull();

      // No overlap between pages
      const allIds = [
        ...page1.body.data.map((e: { id: string }) => e.id),
        ...page2.body.data.map((e: { id: string }) => e.id),
        ...page3.body.data.map((e: { id: string }) => e.id),
      ];
      expect(new Set(allIds).size).toBe(5);
    });

    it('should return null cursor on the last page', async () => {
      const exercise = await insertExercise('Bench Press');
      const entry = await insertWorkoutEntry({
        userId: USER_ID,
        exerciseId: exercise.id,
        performedAt: new Date('2026-11-17T08:00:00Z'),
      });
      await insertExerciseSet({
        workoutEntryId: entry.id,
        setOrder: 1,
        reps: 10,
        weight: 60,
        unit: 'kg',
        weightKg: 60,
      });

      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, limit: 10 });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.pagination.cursor).toBeNull();
    });

    it('should return 400 for a malformed cursor', async () => {
      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, cursor: 'not-a-valid-cursor' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('combined filters', () => {
    it('should combine exercise name and date range filters', async () => {
      await seedStandardData();

      const res = await api().get(ENDPOINT).query({
        userId: USER_ID,
        exerciseName: 'Bench',
        from: '2026-11-16T00:00:00Z',
      });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].performedAt).toBe('2026-11-17T08:00:00.000Z');
    });

    it('should combine muscle group and date range filters', async () => {
      await seedStandardData();

      const res = await api().get(ENDPOINT).query({
        userId: USER_ID,
        muscleGroup: 'Chest',
        from: '2026-11-16T00:00:00Z',
      });

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].exerciseName).toBe('Bench Press');
    });
  });

  describe('validation', () => {
    it('should return 400 when userId is missing', async () => {
      const res = await api().get(ENDPOINT);

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when userId is not a UUID', async () => {
      const res = await api().get(ENDPOINT).query({ userId: 'not-a-uuid' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when from is not a valid ISO 8601 date', async () => {
      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, from: 'not-a-date' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when limit is 0', async () => {
      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, limit: 0 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when limit exceeds 100', async () => {
      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, limit: 101 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when unit is unsupported', async () => {
      const res = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, unit: 'stone' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should return the standard error shape', async () => {
      const res = await api().get(ENDPOINT).query({ userId: 'not-a-uuid' });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body).toEqual({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: expect.any(Array),
        timestamp: expect.any(String),
      });
    });
  });
});
