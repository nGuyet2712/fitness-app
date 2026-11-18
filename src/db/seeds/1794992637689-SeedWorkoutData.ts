import { randomUUID } from 'node:crypto';
import { UNIT_TO_KG } from '@/const/unit';
import { DataSource } from 'typeorm';
import type { Seeder } from 'typeorm-extension';

const MUSCLE_GROUPS = [
  { name: 'Chest' },
  { name: 'Back' },
  { name: 'Shoulders' },
  { name: 'Legs' },
  { name: 'Arms' },
  { name: 'Core' },
];

const EXERCISES: { name: string; muscleGroups: string[] }[] = [
  { name: 'Bench Press', muscleGroups: ['Chest', 'Arms'] },
  { name: 'Incline Dumbbell Press', muscleGroups: ['Chest', 'Shoulders'] },
  { name: 'Cable Fly', muscleGroups: ['Chest'] },
  { name: 'Deadlift', muscleGroups: ['Back', 'Legs'] },
  { name: 'Barbell Row', muscleGroups: ['Back'] },
  { name: 'Pull Up', muscleGroups: ['Back', 'Arms'] },
  { name: 'Lat Pulldown', muscleGroups: ['Back'] },
  { name: 'Overhead Press', muscleGroups: ['Shoulders'] },
  { name: 'Lateral Raise', muscleGroups: ['Shoulders'] },
  { name: 'Squat', muscleGroups: ['Legs'] },
  { name: 'Leg Press', muscleGroups: ['Legs'] },
  { name: 'Romanian Deadlift', muscleGroups: ['Legs', 'Back'] },
  { name: 'Barbell Curl', muscleGroups: ['Arms'] },
  { name: 'Tricep Pushdown', muscleGroups: ['Arms'] },
  { name: 'Plank', muscleGroups: ['Core'] },
  { name: 'Cable Crunch', muscleGroups: ['Core'] },
];

const USERS = [
  'a1111111-1111-4111-8111-111111111111',
  'b2222222-2222-4222-8222-222222222222',
  'c3333333-3333-4333-8333-333333333333',
  'd4444444-4444-4444-8444-444444444444',
];

const BATCH_SIZE = 2000;
const HEAVY_USER_ID = USERS[0];
const HEAVY_USER_ENTRY_COUNT = 60_000;

const UNITS = ['kg', 'lb'] as const;

interface EntryRow {
  id: string;
  userId: string;
  exerciseId: string;
  performedAt: Date;
}
interface SetRow {
  id: string;
  workoutEntryId: string;
  setOrder: number;
  reps: number;
  weight: number;
  unit: string;
  weightKg: number;
}

function roundTo3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export default class SeedWorkoutData1794992637689 implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // --- Muscle groups ---
      const mgIds: Record<string, string> = {};
      for (const mg of MUSCLE_GROUPS) {
        const id = randomUUID();
        mgIds[mg.name] = id;
        await queryRunner.query(
          `INSERT INTO muscle_groups (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, mg.name],
        );
      }
      const mgRows: { id: string; name: string }[] = await queryRunner.query(
        `SELECT id, name FROM muscle_groups`,
      );
      for (const row of mgRows) {
        mgIds[row.name] = row.id;
      }

      // --- Exercises + muscle group links ---
      const exIds: Record<string, string> = {};
      for (const ex of EXERCISES) {
        const id = randomUUID();
        exIds[ex.name] = id;
        await queryRunner.query(
          `INSERT INTO exercises (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, ex.name],
        );
      }
      const exRows: { id: string; name: string }[] = await queryRunner.query(
        `SELECT id, name FROM exercises`,
      );
      for (const row of exRows) {
        exIds[row.name] = row.id;
      }

      for (const ex of EXERCISES) {
        for (const mgName of ex.muscleGroups) {
          await queryRunner.query(
            `INSERT INTO exercise_muscle_groups ("exerciseId", "muscleGroupId")
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [exIds[ex.name], mgIds[mgName]],
          );
        }
      }

      // --- Bulk insert helpers ---
      const flushEntries = async (rows: EntryRow[]) => {
        if (rows.length === 0) return;
        const placeholders: string[] = [];
        const params: unknown[] = [];
        for (let i = 0; i < rows.length; i++) {
          const o = i * 4;
          placeholders.push(`($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4})`);
          params.push(
            rows[i].id,
            rows[i].userId,
            rows[i].exerciseId,
            rows[i].performedAt,
          );
        }
        await queryRunner.query(
          `INSERT INTO workout_entries (id, "userId", "exerciseId", "performedAt")
           VALUES ${placeholders.join(', ')}
           ON CONFLICT DO NOTHING`,
          params,
        );
      };

      const flushSets = async (rows: SetRow[]) => {
        if (rows.length === 0) return;
        const placeholders: string[] = [];
        const params: unknown[] = [];
        for (let i = 0; i < rows.length; i++) {
          const o = i * 7;
          placeholders.push(
            `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7})`,
          );
          params.push(
            rows[i].id,
            rows[i].workoutEntryId,
            rows[i].setOrder,
            rows[i].reps,
            rows[i].weight,
            rows[i].unit,
            rows[i].weightKg,
          );
        }
        await queryRunner.query(
          `INSERT INTO exercise_sets (id, "workoutEntryId", "setOrder", reps, weight, unit, "weightKg")
           VALUES ${placeholders.join(', ')}
           ON CONFLICT DO NOTHING`,
          params,
        );
      };

      let entryBatch: EntryRow[] = [];
      let setBatch: SetRow[] = [];

      const flushAll = async () => {
        await flushEntries(entryBatch);
        await flushSets(setBatch);
        entryBatch = [];
        setBatch = [];
      };

      // --- Generate entries for a user ---
      const generateEntries = async (
        userId: string,
        count: number,
        startDate: Date,
        minuteStep: number,
      ) => {
        const exerciseNames = Object.keys(exIds);
        for (let i = 0; i < count; i++) {
          const exName =
            exerciseNames[i % exerciseNames.length] ?? exerciseNames[0];
          const entryId = randomUUID();
          const performedAt = new Date(
            startDate.getTime() + i * minuteStep * 60_000,
          );
          const unit = UNITS[i % 2];
          const weight = 20 + ((i * 7) % 180);
          const reps = 1 + (i % 15);
          const setsCount = 1 + (i % 4);

          entryBatch.push({
            id: entryId,
            userId,
            exerciseId: exIds[exName],
            performedAt,
          });

          for (let s = 0; s < setsCount; s++) {
            const setWeight = weight + s * 5;
            setBatch.push({
              id: randomUUID(),
              workoutEntryId: entryId,
              setOrder: s + 1,
              reps: Math.max(1, reps - s),
              weight: setWeight,
              unit,
              weightKg: roundTo3(setWeight * (UNIT_TO_KG[unit] ?? 1)),
            });
          }

          if (entryBatch.length >= BATCH_SIZE) {
            await flushAll();
          }
        }
        await flushAll();
      };

      // --- Heavy user: 60k entries ---
      const heavyStart = new Date('2020-01-01T06:00:00Z');
      await generateEntries(
        HEAVY_USER_ID,
        HEAVY_USER_ENTRY_COUNT,
        heavyStart,
        10,
      );

      // --- Other 3 users: 50 entries each ---
      for (const userId of USERS.slice(1)) {
        const userStart = new Date('2020-01-01T06:00:00Z');
        await generateEntries(userId, 50, userStart, 24 * 60);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
