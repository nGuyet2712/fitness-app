import { HttpStatus } from '@nestjs/common';
import { api } from '../helpers/http-client';
import {
  cleanAllTables,
  connectTestDb,
  disconnectTestDb,
  getTestDataSource,
} from '../helpers/typeorm-connection';
import { ExerciseSet, WorkoutEntry } from '@/db/entities';
import {
  countExercises,
  findExerciseByName,
  insertExercise,
} from '../utils/exercise.test-repository';
import {
  countWorkoutEntries,
  insertWorkoutEntry,
} from '../utils/workout-entry.test-repository';
import { countExerciseSets } from '../utils/exercise-set.test-repository';

const ENDPOINT = '/workouts';
const USER_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function validBody(overrides?: Record<string, unknown>) {
  return {
    userId: USER_ID,
    entries: [
      {
        exerciseName: 'Bench Press',
        performedAt: '2026-11-17T08:30:00Z',
        sets: [{ reps: 10, weight: 60, unit: 'kg' }],
      },
    ],
    ...overrides,
  };
}

function validEntry(overrides?: Record<string, unknown>) {
  return {
    exerciseName: 'Bench Press',
    performedAt: '2026-11-17T08:30:00Z',
    sets: [{ reps: 10, weight: 60, unit: 'kg' }],
    ...overrides,
  };
}

function validSet(overrides?: Record<string, unknown>) {
  return { reps: 10, weight: 60, unit: 'kg', ...overrides };
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

describe('POST /workouts', () => {
  describe('successful creation', () => {
    it('should return 201 with the created entries', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
          entries: [
            {
              exerciseName: 'Bench Press',
              performedAt: '2026-11-17T08:30:00+07:00',
              sets: [
                { reps: 10, weight: 60, unit: 'kg' },
                { reps: 8, weight: 135, unit: 'lb' },
              ],
            },
            {
              exerciseName: 'Farmer Carry',
              performedAt: '2026-11-17T08:50:00+07:00',
              sets: [{ reps: 1, weight: 70, unit: 'lb' }],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(2);

      // First entry
      const entry1 = res.body.data[0];
      expect(entry1.userId).toBe(USER_ID);
      expect(entry1.exerciseName).toBe('Bench Press');
      // +07:00 → stored as UTC
      expect(entry1.performedAt).toBe('2026-11-17T01:30:00.000Z');
      expect(entry1.id).toBeDefined();
      expect(entry1.createdAt).toBeDefined();

      // Sets
      expect(entry1.sets).toHaveLength(2);
      expect(entry1.sets[0].setOrder).toBe(1);
      expect(entry1.sets[0].reps).toBe(10);
      expect(entry1.sets[0].weight).toBe(60);
      expect(entry1.sets[0].unit).toBe('kg');
      expect(entry1.sets[0].weightKg).toBe(60);

      expect(entry1.sets[1].setOrder).toBe(2);
      expect(entry1.sets[1].weight).toBe(135);
      expect(entry1.sets[1].unit).toBe('lb');
      expect(entry1.sets[1].weightKg).toBe(61.235);

      // Second entry
      const entry2 = res.body.data[1];
      expect(entry2.exerciseName).toBe('Farmer Carry');
      expect(entry2.sets[0].weightKg).toBe(31.751);
    });

    it('should persist entries and sets in the database', async () => {
      await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
          entries: [
            {
              exerciseName: 'Squat',
              performedAt: '2026-11-17T10:00:00Z',
              sets: [
                { reps: 5, weight: 100, unit: 'kg' },
                { reps: 5, weight: 100, unit: 'kg' },
              ],
            },
          ],
        })
        .expect(201);

      const ds = getTestDataSource();
      const entryCount = await ds.getRepository(WorkoutEntry).count();
      const setCount = await ds.getRepository(ExerciseSet).count();

      expect(entryCount).toBe(1);
      expect(setCount).toBe(2);
    });

    it('should store numeric values as numbers, not strings', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
          entries: [
            {
              exerciseName: 'Deadlift',
              performedAt: '2026-11-17T10:00:00Z',
              sets: [{ reps: 1, weight: 200.5, unit: 'kg' }],
            },
          ],
        })
        .expect(201);

      // Check the response values are numbers.
      const set = res.body.data[0].sets[0];
      expect(typeof set.weight).toBe('number');
      expect(typeof set.weightKg).toBe('number');
      expect(typeof set.reps).toBe('number');
      expect(set.weight).toBe(200.5);
      expect(set.weightKg).toBe(200.5);

      // Check the DB rows via the test connection.
      const ds = getTestDataSource();
      const dbSets = await ds.getRepository(ExerciseSet).find();
      expect(dbSets).toHaveLength(1);
      expect(typeof dbSets[0].weight).toBe('number');
      expect(typeof dbSets[0].weightKg).toBe('number');
      expect(dbSets[0].weight).toBe(200.5);
    });

    it('should accept "KG" as a unit (case-insensitive) and store it as "kg"', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
          entries: [
            {
              exerciseName: 'Bench Press',
              performedAt: '2026-11-17T10:00:00Z',
              sets: [{ reps: 10, weight: 60, unit: 'KG' }],
            },
          ],
        })
        .expect(201);

      expect(res.body.data[0].sets[0].unit).toBe('kg');

      // Confirm in DB too.
      const ds = getTestDataSource();
      const dbSets = await ds.getRepository(ExerciseSet).find();
      expect(dbSets[0].unit).toBe('kg');
    });

    it('should allow weight of 0', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
          entries: [
            {
              exerciseName: 'Bodyweight Squat',
              performedAt: '2026-11-17T10:00:00Z',
              sets: [{ reps: 20, weight: 0, unit: 'kg' }],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data[0].sets[0].weightKg).toBe(0);
    });

    it('should allow performedAt in the future', async () => {
      const future = new Date(Date.now() + 86_400_000).toISOString();

      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
          entries: [
            {
              exerciseName: 'Bench Press',
              performedAt: future,
              sets: [{ reps: 10, weight: 60, unit: 'kg' }],
            },
          ],
        });

      expect(res.status).toBe(201);
    });

    it('should trim and collapse whitespace in exerciseName', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
          entries: [
            {
              exerciseName: '  Bench   Press  ',
              performedAt: '2026-11-17T10:00:00Z',
              sets: [{ reps: 10, weight: 60, unit: 'kg' }],
            },
          ],
        })
        .expect(201);

      expect(res.body.data[0].exerciseName).toBe('Bench Press');
    });

    it('should resolve case-insensitive names within one request to a single exercise', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
          entries: [
            {
              exerciseName: 'Bench Press',
              performedAt: '2026-11-17T08:00:00Z',
              sets: [{ reps: 10, weight: 60, unit: 'kg' }],
            },
            {
              exerciseName: 'bench press',
              performedAt: '2026-11-17T09:00:00Z',
              sets: [{ reps: 5, weight: 80, unit: 'kg' }],
            },
          ],
        });

      expect(res.status).toBe(201);

      const count = await countExercises();
      expect(count).toBe(1);

      // Both entries should return the same stored name.
      expect(res.body.data[0].exerciseName).toBe(res.body.data[1].exerciseName);
    });

    it('should reuse an existing exercise and return its stored name', async () => {
      await insertExercise('Bench Press');

      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
          entries: [
            {
              exerciseName: 'bench press',
              performedAt: '2026-11-17T08:00:00Z',
              sets: [{ reps: 10, weight: 60, unit: 'kg' }],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data[0].exerciseName).toBe('Bench Press');

      const count = await countExercises();
      expect(count).toBe(1);
    });

    it('should auto-create an unknown exercise', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
          entries: [
            {
              exerciseName: 'Zercher Squat',
              performedAt: '2026-11-17T10:00:00Z',
              sets: [{ reps: 5, weight: 80, unit: 'kg' }],
            },
          ],
        });

      expect(res.status).toBe(201);

      const exercise = await findExerciseByName('zercher squat');
      expect(exercise).not.toBeNull();
      expect(exercise!.name).toBe('Zercher Squat');
    });

    it('should handle many parallel requests creating the same new exercise', async () => {
      const requests = Array.from({ length: 8 }, (_, i) =>
        api()
          .post(ENDPOINT)
          .send({
            userId: USER_ID,
            entries: [
              {
                exerciseName: 'Nordic Curl',
                performedAt: `2026-11-17T${String(i + 1).padStart(2, '0')}:00:00Z`,
                sets: [{ reps: 8, weight: 0, unit: 'kg' }],
              },
            ],
          }),
      );

      const results = await Promise.all(requests);

      // All should succeed.
      for (const res of results) {
        expect(res.status).toBe(201);
      }

      // Exactly one exercise row.
      const count = await countExercises();
      expect(count).toBe(1);
    });
  });

  describe('validation ', () => {
    it('should return 400 when entries is empty', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send(validBody({ entries: [] }));

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('entries')]),
      );
    });

    it('should return 400 when entries is not an array', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send(validBody({ entries: 'not-an-array' }));

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when exerciseName is blank (spaces only)', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send(validBody({ entries: [validEntry({ exerciseName: '   ' })] }));

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('exerciseName')]),
      );
    });

    it('should return 400 when unit is unsupported', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send(
          validBody({
            entries: [validEntry({ sets: [validSet({ unit: 'stone' })] })],
          }),
        );

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('unit')]),
      );
    });

    it('should return the standard error shape', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send(validBody({ entries: [] }));

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);

      expect(res.body).toEqual({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: expect.any(Array),
        timestamp: expect.any(String),
      });
    });

    it('should return 400 when body is a bare array', async () => {
      const res = await api().post(ENDPOINT).send([validBody()]);

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('duplicate and atomicity', () => {
    it('should return 400 when two entries share the same exerciseName and performedAt', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
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
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('duplicates')]),
      );
    });

    it('should detect in-payload duplicates when offsets differ but the instant is the same', async () => {
      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
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
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should return 409 when the entry already exists in the database', async () => {
      const exercise = await insertExercise('Bench Press');
      await insertWorkoutEntry({
        userId: USER_ID,
        exerciseId: exercise.id,
        performedAt: new Date('2026-11-17T08:30:00Z'),
      });

      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
          entries: [
            {
              exerciseName: 'Bench Press',
              performedAt: '2026-11-17T08:30:00Z',
              sets: [{ reps: 10, weight: 60, unit: 'kg' }],
            },
          ],
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('already exists')]),
      );
    });

    it('should produce exactly one 201 and four 409s for five identical parallel requests', async () => {
      const body = {
        userId: USER_ID,
        entries: [
          {
            exerciseName: 'Overhead Press',
            performedAt: '2026-11-17T08:30:00Z',
            sets: [{ reps: 5, weight: 40, unit: 'kg' }],
          },
        ],
      };

      const requests = Array.from({ length: 5 }, () =>
        api().post(ENDPOINT).send(body),
      );
      const results = await Promise.all(requests);

      const statuses = results.map((r) => r.status).sort();
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(4);

      // Only one entry row in the DB.
      const count = await countWorkoutEntries();
      expect(count).toBe(1);
    });

    it('should leave no rows when a bulk request fails due to a duplicate entry', async () => {
      // Seed an existing entry that the second item in the batch will collide with.
      const exercise = await insertExercise('Bench Press');
      await insertWorkoutEntry({
        userId: USER_ID,
        exerciseId: exercise.id,
        performedAt: new Date('2026-11-17T08:30:00Z'),
      });

      const exercisesBefore = await countExercises();

      // The first entry is new and would succeed on its own. The second
      // entry collides with the seeded row → 409 and the entire request
      // rolls back.
      const res = await api()
        .post(ENDPOINT)
        .send({
          userId: USER_ID,
          entries: [
            {
              exerciseName: 'Brand New Exercise',
              performedAt: '2026-11-17T10:00:00Z',
              sets: [{ reps: 5, weight: 50, unit: 'kg' }],
            },
            {
              exerciseName: 'Bench Press',
              performedAt: '2026-11-17T08:30:00Z',
              sets: [{ reps: 10, weight: 60, unit: 'kg' }],
            },
          ],
        });

      expect(res.status).toBe(409);

      // The new entry and its sets should not exist.
      const entryCount = await countWorkoutEntries();
      // Only the seeded entry remains.
      expect(entryCount).toBe(1);

      const setCount = await countExerciseSets();
      // The seeded entry had no sets.
      expect(setCount).toBe(0);

      // The auto-created exercise should have been rolled back too.
      const exercisesAfter = await countExercises();
      expect(exercisesAfter).toBe(exercisesBefore);
    });
  });
});
