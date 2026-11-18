import { HttpStatus } from '@nestjs/common';
import { api } from '../helpers/http-client';
import {
  cleanAllTables,
  connectTestDb,
  disconnectTestDb,
} from '../helpers/typeorm-connection';
import { insertExercise } from '../utils/exercise.test-repository';
import { insertExerciseSet } from '../utils/exercise-set.test-repository';
import { insertWorkoutEntry } from '../utils/workout-entry.test-repository';

const ENDPOINT = '/personal-records';
const USER_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const OTHER_USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

async function seedPrData() {
  const bench = await insertExercise('Bench Press');
  const squat = await insertExercise('Squat');

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
    reps: 3,
    weight: 100,
    unit: 'kg',
    weightKg: 100,
  });

  const entry3 = await insertWorkoutEntry({
    userId: USER_ID,
    exerciseId: bench.id,
    performedAt: new Date('2026-10-10T08:00:00Z'),
  });
  await insertExerciseSet({
    workoutEntryId: entry3.id,
    setOrder: 1,
    reps: 8,
    weight: 70,
    unit: 'kg',
    weightKg: 70,
  });

  const entry4 = await insertWorkoutEntry({
    userId: USER_ID,
    exerciseId: squat.id,
    performedAt: new Date('2026-11-16T10:00:00Z'),
  });
  await insertExerciseSet({
    workoutEntryId: entry4.id,
    setOrder: 1,
    reps: 5,
    weight: 120,
    unit: 'kg',
    weightKg: 120,
  });

  return { bench, squat };
}

describe('GET /personal-records', () => {
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

  describe('validation', () => {
    it('should return 400 when userId is missing', async () => {
      const { status, body } = await api()
        .get(ENDPOINT)
        .query({ exerciseName: 'Bench Press' });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('userId')]),
      );
    });

    it('should return 400 when exerciseName is missing', async () => {
      const { status, body } = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('exerciseName')]),
      );
    });

    it('should return 400 for unsupported unit', async () => {
      await seedPrData();

      const { status, body } = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, exerciseName: 'Bench Press', unit: 'stone' });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('unit')]),
      );
    });

    it('should return 400 for unknown exerciseName', async () => {
      const { status, body } = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, exerciseName: 'NonExistentExercise' });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Unknown exercise name'),
        ]),
      );
    });
  });

  describe('PR computation', () => {
    it('should return 200 with correct PR values', async () => {
      await seedPrData();

      const { status, body } = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, exerciseName: 'Bench Press' });

      expect(status).toBe(HttpStatus.OK);
      expect(body.data.exerciseName).toBe('Bench Press');
      expect(body.data.unit).toBe('kg');

      expect(body.data.current.heaviestSet.value).toBe(100);
      expect(body.data.current.heaviestSet.date).toBe(
        '2026-11-17T08:00:00.000Z',
      );

      expect(body.data.current.highestVolume.value).toBe(600);
      expect(body.data.current.highestVolume.date).toBe(
        '2026-11-15T08:00:00.000Z',
      );

      expect(body.data.current.bestEstimated1RM).not.toBeNull();
      expect(body.data.previous).toBeNull();
    });

    it('should return null PRs when no data exists for the user', async () => {
      await insertExercise('Bench Press');

      const { status, body } = await api()
        .get(ENDPOINT)
        .query({ userId: OTHER_USER_ID, exerciseName: 'Bench Press' });

      expect(status).toBe(HttpStatus.OK);
      expect(body.data.current.heaviestSet).toBeNull();
      expect(body.data.current.highestVolume).toBeNull();
      expect(body.data.current.bestEstimated1RM).toBeNull();
    });

    it('should resolve exercise name case-insensitively', async () => {
      await seedPrData();

      const { status, body } = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, exerciseName: 'bench press' });

      expect(status).toBe(HttpStatus.OK);
      expect(body.data.exerciseName).toBe('Bench Press');
      expect(body.data.current.heaviestSet).not.toBeNull();
    });
  });

  describe('unit conversion', () => {
    it('should convert weights to the requested unit', async () => {
      await seedPrData();

      const { status, body } = await api()
        .get(ENDPOINT)
        .query({ userId: USER_ID, exerciseName: 'Bench Press', unit: 'lb' });

      expect(status).toBe(HttpStatus.OK);
      expect(body.data.unit).toBe('lb');
      expect(body.data.current.heaviestSet.value).toBe(220.462);
    });
  });

  describe('date filtering', () => {
    it('should filter by date range', async () => {
      await seedPrData();

      const { status, body } = await api().get(ENDPOINT).query({
        userId: USER_ID,
        exerciseName: 'Bench Press',
        from: '2026-11-01T00:00:00Z',
        to: '2026-11-30T23:59:59Z',
      });

      expect(status).toBe(HttpStatus.OK);
      expect(body.data.current.heaviestSet.value).toBe(100);
      expect(body.data.current.highestVolume.value).toBe(600);
    });

    it('should return null PRs when date range has no data', async () => {
      await seedPrData();

      const { status, body } = await api().get(ENDPOINT).query({
        userId: USER_ID,
        exerciseName: 'Bench Press',
        from: '2025-01-01T00:00:00Z',
        to: '2025-01-31T23:59:59Z',
      });

      expect(status).toBe(HttpStatus.OK);
      expect(body.data.current.heaviestSet).toBeNull();
    });
  });

  describe('period comparison', () => {
    it('should return both current and previous period PRs', async () => {
      await seedPrData();

      const { status, body } = await api().get(ENDPOINT).query({
        userId: USER_ID,
        exerciseName: 'Bench Press',
        from: '2026-11-01T00:00:00Z',
        to: '2026-11-30T23:59:59Z',
        compareFrom: '2026-10-01T00:00:00Z',
        compareTo: '2026-10-31T23:59:59Z',
      });

      expect(status).toBe(HttpStatus.OK);

      expect(body.data.current.heaviestSet.value).toBe(100);

      expect(body.data.previous).not.toBeNull();
      expect(body.data.previous.heaviestSet.value).toBe(70);
      expect(body.data.previous.heaviestSet.date).toBe(
        '2026-10-10T08:00:00.000Z',
      );
    });

    it('should return 400 when compareFrom/compareTo are provided without from/to', async () => {
      await seedPrData();

      const { status, body } = await api().get(ENDPOINT).query({
        userId: USER_ID,
        exerciseName: 'Bench Press',
        compareFrom: '2025-01-01T00:00:00Z',
        compareTo: '2025-01-31T23:59:59Z',
      });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('from is required'),
          expect.stringContaining('to is required'),
        ]),
      );
    });
  });
});
