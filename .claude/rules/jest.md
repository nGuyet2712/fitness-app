# Jest Testing Patterns

## Setup Facts

- Jest 29 runs in **native ESM** mode (`node --experimental-vm-modules`), because `@nestjs/testing` 12 is ESM-only and Jest's CommonJS mode can't load ES modules. The built app is CommonJS; only tests run as ESM
- `ts-jest` with `useESM: true` and a `tsconfig` override (`module: esnext`, `moduleResolution: bundler`) in both Jest configs, so test and source files are emitted as ES modules. Without the override, `module: nodenext` emits CommonJS (there is no `"type": "module"`) and every suite fails with `exports is not defined`
- Jest's resolver handles the extensionless relative imports. The only `moduleNameMapper` entry (in both configs) maps the `@/` path alias to `src/`
- Import `jest` explicitly when you need it: `import { jest } from '@jest/globals';`
- In ESM, `jest.mock()` is **not** hoisted. Prefer mocking through Nest DI (`useValue`); use `jest.unstable_mockModule` + dynamic `import()` only when a module must be mocked

## Test Naming

**Pattern:** `"should [expected behavior] when [condition]"`

```typescript
it('should convert lb to kg correctly when unit is lb', async () => { ... });
it('should return 400 when sets array is empty', async () => { ... });
it('should return null PRs when no data exists', async () => { ... });
```

Organize with hierarchical `describe` blocks: service → method → scenarios.

## Unit Tests (`src/**/*.spec.ts`)

- Config: `jest.config.json` (project root, `roots: src`)
- Live next to the source file
- Mock all external dependencies (repositories, DataSource)
- Don't mock pure utils (`utils/*.ts`): they are deterministic, so service tests use the real ones
- Run without a database: `npm test` (coverage: `npm run test:cov`)

```typescript
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WorkoutsService } from './workouts.service';
import { WorkoutEntry } from '../../db/entities';

const module: TestingModule = await Test.createTestingModule({
  providers: [
    WorkoutsService,
    { provide: getRepositoryToken(WorkoutEntry), useValue: mockRepo },
    { provide: DataSource, useValue: mockDataSource },
  ],
}).compile();
```

## Integration Tests (`__test__/**/*.spec.ts`)

- Config: `jest.integration.config.json` (project root, `roots: __test__`)
- Tests send HTTP requests (Supertest) to the **already running** app (`docker compose up --build --watch`), then run with `npm run test:integration` (serial, `--runInBand`, 10s `testTimeout`)
- Tests and the app share one database (`DB_*` from the environment or `.env`). The tests empty its entity tables; `npm run seed:run` restores the seed data
- No schema setup in the tests: the schema is whatever migrations the Docker entrypoint already applied. A new migration reaches the tests after `docker compose restart everfit-backend` (or `npm run migration:run`)
- Helpers in `__test__/helpers/`:
  - `http-client.ts`: `api()` returns Supertest bound to `API_BASE_URL` (`INTEGRATION_TEST_BASE_URL`, default `http://localhost:${PORT}`)
  - `typeorm-connection.ts`: the test's own TypeORM connection (loads `.env`), used to seed data before a request and check rows after it. `connectTestDb()`, `getTestDataSource()`, `disconnectTestDb()`, and `cleanAllTables()`: `TRUNCATE … RESTART IDENTITY CASCADE` on every entity table (the `migrations` table is kept)
- Seeding helpers in `__test__/utils/`: one `<entity>.test-repository.ts` per entity (built on `getTestDataSource()`), added as entities land
- Pattern: `beforeAll` → `await connectTestDb()`; `beforeEach` → `await cleanAllTables()`; `afterAll` → `await cleanAllTables()` then `await disconnectTestDb()`
- Tests can control the **data** (insert rows through the test connection) but not the app's **code**: no provider overrides, no clock or failure injection.

## What to Test

**Rule of thumb:** if the behavior depends on PostgreSQL (constraints, `ON CONFLICT`, transactions, isolation, `numeric` precision), test it in an integration test. A mock would only test the mock.

| Priority | Layer | What | Examples |
|----------|-------|------|----------|
| 1 | Unit | Pure utils | Unit conversion (incl. unsupported unit throws), Epley 1RM accuracy, cursor encode/decode round-trip, malformed cursor throws |
| 2 | Unit | Service logic (mocked repos / QueryRunner) | Weight normalization, set ordering, in-payload duplicate → 400, `23505` mapped to 409, rollback + release called on failure |
| 3 | Integration | API validation | 400 with specific messages for: zero/negative reps, negative weight, null/malformed date, empty sets, unsupported unit, unknown properties |
| 4 | Integration | API behavior | Filtering (partial name, date range, muscle group), cursor pagination, empty range → 200 + empty list, response unit conversion, bulk logging, PRs + period comparison |
| 5 | Integration only | DB guarantees | Name casing resolves to one exercise; concurrent auto-create → one row; parallel duplicate entries → one 201 + one 409; failed bulk leaves no rows |

## Rules

✅ Must do:
- `async/await` for all async tests
- Descriptive test names following the pattern above
- Mock all external dependencies in unit tests
- Test behavior, not implementation details

❌ Never:
- Share mutable state between tests
- Use `console.log` in tests
- Skip error/edge case testing
