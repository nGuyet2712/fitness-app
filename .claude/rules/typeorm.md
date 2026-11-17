# TypeORM & PostgreSQL Patterns

## Schema Verification

Never assume a column, index or relation exists. Check `src/db/entities/` and `src/db/migrations/` before referencing database structure. 

## Schema Overview

| Table | Key columns | Notes |
|-------|-------------|-------|
| `exercises` | `id`, `name`, `createdAt` | Unique expression index on `LOWER(name)` |
| `muscle_groups` | `id`, `name`, `createdAt` | Unique expression index on `LOWER(name)` |
| `exercise_muscle_groups` | `exerciseId`, `muscleGroupId` | Join table, composite PK, no extra columns |
| `workout_entries` | `id`, `userId`, `exerciseId`, `performedAt`, `createdAt` | `exerciseId` FK `ON DELETE RESTRICT` |
| `exercise_sets` | `id`, `workoutEntryId`, `setOrder`, `reps`, `weight`, `unit`, `weightKg`, `createdAt` | FK `ON DELETE CASCADE`; `weight`/`weightKg` are `numeric(9,3)` |

CHECK constraints on `exercise_sets`: `reps > 0`, `weight >= 0`, `weightKg >= 0`, `setOrder >= 1`.

## Entity Pattern

```typescript
import { v4 as uuidv4 } from 'uuid';

@Entity('exercise_sets')
export class ExerciseSet {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'smallint' })
  setOrder: number;

  @Column({ type: 'numeric', precision: 9, scale: 3, transformer: numericTransformer })
  weightKg: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => WorkoutEntry, (entry) => entry.sets, { onDelete: 'CASCADE' })
  workoutEntry: WorkoutEntry;
}
```

- `@PrimaryColumn('uuid')` for all single-column primary keys
- `timestamptz` for all date columns
- `pg` returns `numeric` as a **string**. Use a column transformer (or convert explicitly) so services work with numbers
- Entities live in `src/db/entities/`. Register each new entity in `src/db/entities/index.ts`: re-export it and append its class to `allEntities` (an explicit list like `allMigrations` so that the app, the CLIs and the integration tests load it)

## Relations

- `@OneToMany` with `cascade: true` for parent → children (`WorkoutEntry` → `ExerciseSet`)
- `@ManyToOne` with `onDelete: 'CASCADE'` for sets → entry
- `WorkoutEntry` → `Exercise` uses `onDelete: 'RESTRICT'`, so an exercise with history can't be deleted
- Exercise ↔ muscle group is many-to-many through `exercise_muscle_groups` with a composite primary key

## Exercise Resolution

Clients send `exerciseName`; the service resolves it to `exerciseId`:
1. Match case-insensitively: `LOWER(name) = LOWER(:name)`
2. If no row matches, `INSERT ... ON CONFLICT DO NOTHING`, then re-select. Concurrent requests for the same new name therefore never create duplicates or fail
3. Auto-created exercises have no muscle groups until a row is added to `exercise_muscle_groups`

## Migrations

- Location: `src/db/migrations/`; the CLI data source is `src/config/data-source.config.ts`
- Generate from entity changes: `npm run migration:generate -- src/db/migrations/<MigrationName>`
- Review generated migrations. Expression indexes (`LOWER(name)`) and CHECK constraints may need to be added or kept by hand
- Register every new migration class in `src/db/migrations/index.ts` (`allMigrations`, oldest first). `npm run migration:run` only runs migrations in that list (the CLI data source uses `typeOrmConfig()`), so an unregistered migration is silently skipped. Keep the generated `<timestamp>-<Name>.ts` file naming
- UUIDs are generated in the app layer (`uuid` npm package), not by the database. 
- Apply: `npm run migration:run`; revert: `npm run migration:revert`
- The app never runs migrations on startup. The local Docker entrypoint (`scripts/local-entrypoint.sh`) runs `npm run migration:run` before starting the app; every other environment runs it as a separate deploy step
- Migrations are the only way the schema changes: `synchronize` is always `false`, so local, test and production schemas are built the same way

## Seeds

- Location: `src/db/seeds/`; seeders run through typeorm-extension with data source `src/config/seeder.config.ts` (the CLI data source + `seeds`)
- Create: `npm run seed:create -- src/db/seeds/<Name>` → `<timestamp>-<Name>.ts` with a `Seeder` class; the `*-*.ts` naming is what `seed:run` matches
- Run: `npm run seed:run` (the local Docker entrypoint runs it on every start, after migrations)
- `seedTracking` is off: a tracking table would be created outside migrations. Every run executes every seeder, so seeders must be idempotent (`INSERT ... ON CONFLICT DO NOTHING`, matching the `LOWER(name)` unique indexes)
- Seeds insert data only, never change the schema

## Query Building

Use QueryBuilder for dynamic queries with conditional filters:
```typescript
const qb = this.entryRepo
  .createQueryBuilder('entry')
  .innerJoin('entry.exercise', 'exercise')
  .where('entry.userId = :userId', { userId });

if (exerciseName) {
  qb.andWhere('LOWER(exercise.name) = LOWER(:exerciseName)', { exerciseName });
}
```

- PRs are computed in SQL (`ORDER BY ... LIMIT 1` over the entry/set join) on `numeric`, not in JS
- Always use parameterized queries — never concatenate user input

## Transactions

```typescript
const qr = this.dataSource.createQueryRunner();
await qr.connect();
await qr.startTransaction();
try {
  await qr.manager.save(entity);
  await qr.commitTransaction();
} catch (error) {
  await qr.rollbackTransaction();
  throw error;
} finally {
  await qr.release();
}
```

## Rules

✅ Always:
- Index frequently queried columns
- Paginate large result sets
- Use transactions for multi-step writes
- Release the QueryRunner in `finally`

❌ Never:
- Use `synchronize: true` in production
- Concatenate strings in SQL queries
- Forget to release the QueryRunner
