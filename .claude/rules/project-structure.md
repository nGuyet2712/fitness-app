# Everfit Project Structure

## Overview

Everfit is a workout logging REST API built with NestJS + PostgreSQL. Coaches log client workouts, query history with filtering, and track personal records (PRs).

## Tech Stack

- **Runtime**: Node.js 22.12+ (`engines` in `package.json`, see `Dockerfile`) + TypeScript 6 (`strict: true`)
- **Module system**: CommonJS relative imports have no extension.
- **Framework**: NestJS 12 (Express platform)
- **Database**: PostgreSQL 16 (`postgres:16-alpine` in `docker-compose.yml`) with TypeORM 0.3 (`@nestjs/typeorm`, `pg`)
- **Config**: `@nestjs/config` with namespaced config (`registerAs`) in `src/config/`
- **Validation**: class-validator + class-transformer
- **Logging**: Winston via nest-winston
- **Testing**: Jest 29 in native ESM mode + Supertest
- **Lint/format**: ESLint 8 (`.eslintrc.cjs`) + Prettier 3

## Directory Layout

```
src/
├── main.ts                       # Bootstrap: Winston logger, configureApp(), listen
├── app.setup.ts                  # configureApp(): request logger, global ValidationPipe, exception filter (shared with tests)
├── app.module.ts                 # Root module — ConfigModule, TypeOrmModule, every feature module
├── config/
│   ├── app.config.ts             # registerAs('app', ...): port, nodeEnv, logLevel
│   ├── database.config.ts        # registerAs('database', ...) + typeOrmConfigAsync (TypeORM options for the app)
│   ├── data-source.config.ts     # DataSource used by the TypeORM CLI (same connection settings)
│   └── seeder.config.ts          # data-source.config + seed settings, used by `npm run seed:run` (typeorm-extension)
├── common/                       # Shared providers (used by more than one feature) + app-wide plumbing
│   ├── common.module.ts          # Exports shared providers
│   ├── exercises/                # exercise-resolver.service.ts (provider, injects DataSource)
│   ├── filters/                  # all-exceptions.filter.ts (global exception filter)
│   ├── logger/                   # app-logger.ts: createAppLogger() (Winston, JSON in production)
│   └── middleware/               # request-logger.middleware.ts (one log line per request)
├── utils/                        # Shared pure functions (used by more than one feature, or API-wide)
│   ├── unit-conversion.ts        # (+ unit-conversion.spec.ts)
│   └── cursor.ts                 # (+ cursor.spec.ts)
├── components/
│   ├── workouts/                 # Bulk workout logging + history
│   └── personal-records/         # PRs + period comparison; utils/pr-calculator.ts (+ .spec.ts)
└── db/
    ├── entities/                 # TypeORM entities, re-exported from index.ts
    ├── migrations/               # Migration history + index.ts (allMigrations: explicit list, register each new migration)
    └── seeds/                    # Exercise / muscle group seed data
__test__/                         # Integration tests (real PostgreSQL)
├── helpers/                      # Shared test code, no .spec.ts files (see jest.md → Integration Tests)
│   ├── http-client.ts            # api(): Supertest against the running app (INTEGRATION_TEST_BASE_URL)
│   └── typeorm-connection.ts     # Test DB connection + cleanAllTables() (entity tables only)
├── utils/
│   └── <entity>.test-repository.ts  # Seeding helpers, one per entity
├── app/                          # App-wide behaviour (validation, error shape, helpers)
└── <feature>/                    # One folder per src/components/<feature>
    └── <scenario>.spec.ts        # e.g. workouts/bulk-create.spec.ts
jest.config.json                  # Jest config for unit tests (src/)
jest.integration.config.json      # Jest config for integration tests (__test__/)
```

## Utils vs Providers

Logic outside services and controllers is either a **util** or a **provider**:

| Kind | When | Shape | Tested by |
|------|------|-------|-----------|
| Util | Pure, no dependencies | Named-export functions/constants in `utils/<name>.ts` (no class, no `export default`) | Calling the functions directly; service tests use the real util, not a mock |
| Provider | Has dependencies (`DataSource`, repositories, config) or must be mocked in service tests | `@Injectable()` class in `<name>.service.ts` | `TestingModule` with mocked dependencies |

Utils are plain imports, so DTO decorators can use them too (e.g. `@IsIn(SUPPORTED_UNITS)` from the unit conversion registry). Decorators run outside Nest DI and can't use an injected provider.

| Logic | Kind | Location | Used by |
|-------|------|----------|---------|
| Unit conversion registry | Util | `src/utils/unit-conversion.ts` | workouts (log → kg, history → requested unit), personal-records (PRs in requested unit), DTO unit validation |
| Exercise resolver | Provider | `src/common/exercises/exercise-resolver.service.ts` | workouts (`resolveOrCreate`), personal-records (`findByName`) |
| Cursor encoding | Util | `src/utils/cursor.ts` | workouts history today; any future list endpoint (cursor pagination is API-wide, see `api-design.md`) |
| PR calculator | Util | `src/components/personal-records/utils/pr-calculator.ts` | personal-records only |

The exercise resolver centralises case-insensitive `LOWER(name)` matching so it lives in one place:
- `resolveOrCreate(names: string[], manager: EntityManager)`: write path for logging. Takes all names in the request at once (2 queries total, not 2 per entry). Deduplicates and sorts names to avoid deadlocks, then `INSERT ... ON CONFLICT DO NOTHING` + re-select. Runs inside the caller's transaction (receives an `EntityManager`)
- `findByName(name)`: read-only lookup. Read endpoints (e.g. PRs) must never auto-create an exercise; an unknown name means no data
- History's partial-match filter (`ILIKE`) is a query condition in the workouts service, not a resolver method

Placement rules:
- Used by more than one feature → a shared util goes in `src/utils/`, a shared provider in `src/common/<area>/`
- Used by one feature → that feature's folder (`utils/` for utils). Move it to `src/utils/` or `src/common/` when a second feature needs it
- Exception: generic infrastructure for an API-wide convention (e.g. cursor encoding) goes in `src/utils/` even with one user. The feature-specific part (which columns form the keyset, the `WHERE` clause) stays in the feature service
- Check `src/utils/` and `src/common/` before adding a util or provider, so the same logic isn't implemented twice
- `CommonModule` (`src/common/common.module.ts`) lists each shared provider in both `providers` and `exports`; feature modules add `imports: [CommonModule]`. Utils are never registered in a module
- The global exception filter lives in `src/common/filters/` and is registered in `configureApp()` (`src/app.setup.ts`, called by `main.ts`), not in `CommonModule`

## Feature Module Structure

```
src/components/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.service.spec.ts
├── <name>.service.ts             # optional: feature-only provider (has dependencies), in this module's providers, not exported
├── utils/                        # optional: feature-only pure functions, e.g. pr-calculator.ts (+ pr-calculator.spec.ts)
└── dto/
```

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Entity | `src/db/entities/<name>.entity.ts` | `workout-entry.entity.ts` |
| Controller | `<feature>.controller.ts` | `workouts.controller.ts` |
| Service | `<feature>.service.ts` | `workouts.service.ts` |
| Module | `<feature>.module.ts` | `workouts.module.ts` |
| DTO | `dto/<action>-<name>.dto.ts` | `create-workout.dto.ts` |
| Shared provider | `src/common/<area>/<name>.service.ts` | `src/common/exercises/exercise-resolver.service.ts` |
| Shared util | `src/utils/<name>.ts` | `src/utils/unit-conversion.ts`, `src/utils/cursor.ts` |
| Feature util | `src/components/<feature>/utils/<name>.ts` | `src/components/personal-records/utils/pr-calculator.ts` |
| Unit test | `<name>.spec.ts`, next to the source file | `workouts.service.spec.ts` |
| Integration test | `__test__/<feature>/<scenario>.spec.ts` | `__test__/workouts/bulk-create.spec.ts` |
| Integration test helper | `__test__/helpers/<name>.ts` | `__test__/helpers/http-client.ts` |
| Integration test seeding helper | `__test__/utils/<entity>.test-repository.ts` | `__test__/utils/exercise.test-repository.ts` |
| Migration | `src/db/migrations/<timestamp>-<Name>.ts` (generated) | `1731600000000-CreateWorkouts.ts` |

