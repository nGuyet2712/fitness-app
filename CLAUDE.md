# Everfit — Workout Logging API

NestJS REST API for coaches to track client workout metrics and personal records.

## Tech Stack

- **Runtime**: Node.js 22+ (`engines` in `package.json`, see `Dockerfile`) + TypeScript 6
- **Module system**: CommonJS (no `"type"` in `package.json`, `module: nodenext`): relative imports have no extension (e.g. `./app.service`). NestJS 12 is ESM-only; the built app loads it with `require()`, which needs Node 22.12+
- **Framework**: NestJS 12 (Express platform)
- **Database**: PostgreSQL 16 with TypeORM 0.3 (`@nestjs/typeorm`, `pg`)
- **Validation**: class-validator + class-transformer
- **Logging**: Winston (via nest-winston)
- **Testing**: Jest 29 (native ESM mode) + Supertest (unit + integration)
- **Lint/format**: ESLint 8 (`.eslintrc.cjs`) + Prettier 3 (single quotes, trailing commas, LF line endings)
- **Containerization**: Docker + Docker Compose

## Common Commands

```bash
npm run start:dev          # Development mode with hot reload
npm run build              # Build for production
npm run start:prod         # Run production build
npm test                   # Unit tests in src/ (no DB required)
npm run test:cov           # Unit tests with coverage
npm run test:integration   # Integration tests in __test__/ (runs against the .env database and wipes it)
npm run lint               # ESLint with --fix
npm run format             # Prettier write on src/ and __test__/
npm run seed:run           # Run the seeders in src/db/seeds/
docker compose up --build --watch  # Start everything (API + PostgreSQL), hot reload on src/ changes
```

## Testing Strategy

**Unit tests** (`src/**/*.spec.ts`, config in `jest.config.json`): Test pure logic — utility functions, services with mocked repositories, and edge cases. No database required.

**Integration tests** (`__test__/**/*.spec.ts`, config in `jest.integration.config.json`): Test the full HTTP request lifecycle — endpoint validation, filtering, pagination, bulk operations, and PR calculations. Uses real PostgreSQL and runs serially (`--runInBand`).

Jest runs as native ESM (`node --experimental-vm-modules`) because `@nestjs/testing` 12 is ESM-only, so tests load the sources as ES modules while the built app is CommonJS (the Jest configs override ts-jest to `module: esnext`).

## Database Migrations

- All migration commands run through npm → `npm run typeorm` (ts-node + TypeORM CLI with data source `src/config/data-source.config.ts`); pass extra CLI args after `--`
- Generate from entity changes: `npm run migration:generate -- src/db/migrations/<MigrationName>`
- After generating, register the new class in `src/db/migrations/index.ts` (`allMigrations`). The app and the integration tests load migrations from that list; the CLI finds them by file name (`*-*.ts`)
- Run migrations: `npm run migration:run` (the local Docker entrypoint runs it on every start, before seeds; the app itself never runs migrations)
- Revert last migration: `npm run migration:revert`

## Seeds

- Seeders live in `src/db/seeds/` and run through typeorm-extension with data source `src/config/seeder.config.ts` (the CLI data source + seed settings)
- Create: `npm run seed:create -- src/db/seeds/<Name>` (writes `<timestamp>-<Name>.ts`)
- Run: `npm run seed:run`. The local Docker entrypoint runs it on every start, after migrations
- There is no seed tracking table (it would be created outside migrations), so every run executes every seeder: seeders must be idempotent (`INSERT ... ON CONFLICT DO NOTHING`)

## Architecture

**Layer order:** Controller → Service → Repository/DataSource → Entity

**Source layout:**
```
src/
├── main.ts                   # Bootstrap
├── app.module.ts             # Root module
├── config/                   # Database + TypeORM CLI config
├── components/<feature>/     # Feature API modules
└── db/
    ├── entities/             # TypeORM entities
    ├── migrations/           # Migration history
    └── seeds/                # Seeders (`npm run seed:run`)
__test__/                     # Integration tests
```

**Feature module structure:**
```
src/components/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.repository.ts
├── <feature>.service.spec.ts
└── dto/
```

**Database schema sources of truth:**
1. `src/db/entities/` — TypeORM entity definitions (re-exported from `src/db/entities/index.ts` and registered in `allEntities`)
2. `src/db/migrations/` — migration history

Always check entity files before referencing any column, index, or relation.

## Key Design Decisions

- **UTC everywhere** — All dates stored as `TIMESTAMP WITH TIME ZONE` in UTC
- **Normalized weight storage** — Every set stores original `weight`/`unit` plus `weightKg` (normalized)
- **Extensible unit conversion** — Unit conversion uses a conversion map; add a new unit = add one entry
- **Exercises resolved by name** — clients send `exerciseName`; the service resolves it case-insensitively to `exercises.id` (unique index on `LOWER(name)`) and auto-creates unknown exercises via `INSERT ... ON CONFLICT DO NOTHING` + re-select, so concurrent requests for the same new name never duplicate. `workout_entries.exerciseId` is FK-constrained (`ON DELETE RESTRICT`); auto-created exercises have no muscle groups until a row is added to `exercise_muscle_groups` (mapping is DB data only — never hardcode exercise or muscle group names in code)
- **Migrations are the only schema source** — `synchronize` is always off. The app never runs migrations on start: the local Docker entrypoint runs `npm run migration:run` then `npm run seed:run` on every start; other environments run `npm run migration:run` as a deploy step

## Critical Rules

- Validate all input via DTOs with class-validator
- Use parameterized queries — never concatenate user input into SQL
- Use transactions (QueryRunner) for bulk/multi-row writes
- Store dates in UTC (`TIMESTAMP WITH TIME ZONE`)
- Never use `synchronize: true` in production
- Register new feature modules from `src/components/` in `src/app.module.ts`

## Detailed Standards

See `.claude/rules/` for patterns:
- `api-design.md` — REST conventions, DTOs, pagination, error responses
- `coding-guidelines.md` — TypeScript rules, NestJS patterns, error handling
- `jest.md` — Test structure, mocking, integration setup
- `typeorm.md` — Entity patterns, migrations, query building, transactions
- `project-structure.md` — Module layout, file naming
