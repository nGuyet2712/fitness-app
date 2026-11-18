# Coding Guidelines

## TypeScript Rules

- `strict: true` is on — use explicit types and avoid `any` (ESLint doesn't block `any`, so this is on you)
- No non-null assertions (`!`) — use optional chaining or type guards
- Prefer named exports. Exception: `registerAs(...)` config factories and the TypeORM CLI `DataSource` in `src/config/` use `export default`
- Consolidate imports from the same source into a single line
- Formatting is Prettier's job (single quotes, trailing commas) — run `npm run format` / `npm run lint`

## Module System

The app compiles to CommonJS (no `"type"` in `package.json`, `module: nodenext`), but Jest runs the same sources as ES modules (see `jest.md`). Code in `src/` must work in both.

Relative imports have **no** extension:

```typescript
// ❌ BAD
import { WorkoutsService } from './workouts.service.ts';

// ✅ GOOD
import { WorkoutsService } from './workouts.service';
import { WorkoutEntry, ExerciseSet } from '@/db/entities';
```

- Always write `import`, never `require()`. TypeScript emits the `require()` calls in `dist/`
- No top-level `await`: CommonJS doesn't allow it, so `main.ts` calls `void bootstrap()`
- No `__dirname`, `__filename` or `require()`: they exist in the built app but not when Jest runs the code as ES modules
- No `import.meta`: it doesn't compile to CommonJS
- NestJS 12 packages are ESM-only. The built app loads them with `require()`, which needs Node 22.12+ (`engines` in `package.json`)

## NestJS Module Pattern

Each feature lives in `src/components/<feature>/` with its own module, controller, service, service spec and `dto/` folder, and is registered in `src/app.module.ts`.

## Controller Layer

- Parse request params, query and body (already validated by DTOs)
- Call service methods and return the result
- No business logic — delegate everything to the service

## Service Layer

- Contains business logic
- Inject repositories via `@InjectRepository(Entity)`
- Inject `DataSource` when raw SQL or transactions are needed
- Use transactions (QueryRunner) for bulk/multi-row writes
- Keep pure logic (unit conversion, PR formulas, cursor encoding) out of services, as named-export functions in `utils/`, so it can be unit-tested without a database and imported by DTOs
- Use an `@Injectable()` provider only for logic with dependencies, e.g. the exercise resolver (injects `DataSource`). See `project-structure.md` → Utils vs Providers
- Log meaningful business events through the Nest `Logger` (backed by Winston)

## Domain Rules

- Never hardcode exercise or muscle group names in code. The exercise ↔ muscle group mapping is DB data only (seeds or rows in `exercise_muscle_groups`)
- Adding a weight unit = adding one entry to the unit conversion registry
- Always persist the original `weight`/`unit` **and** the normalized `weightKg`

## Error Handling

- Use NestJS built-in exceptions: `BadRequestException`, `NotFoundException`, `ConflictException`
- Validate at system boundaries only (DTOs) — internal code trusts validated data
- Never use `console.log()` — use the Nest `Logger` (Winston via nest-winston)

## Configuration

- All configuration comes from environment variables, read through `@nestjs/config` namespaces in `src/config/`
- No hardcoded hosts, ports or credentials outside the config defaults

## Date/Time

- Store as `TIMESTAMP WITH TIME ZONE` in UTC
- Accept ISO 8601 strings from clients
- No timezone assumptions — conversion is the client's responsibility

## Security

- Use parameterized queries — never concatenate user input into SQL
- Validate all input at API boundaries via DTOs
