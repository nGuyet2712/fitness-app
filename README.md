# Everfit — Workout Logging API

A REST API for coaches to log client workouts and track personal records (PRs) over time.

Built with **NestJS 12** + **PostgreSQL 16** + **TypeORM 0.3**, packaged with **Docker Compose**.

- [Architecture Overview](#architecture-overview)
- [Setup](#setup)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Design Decisions & Trade-offs](#design-decisions--trade-offs)
- [What Would Change at Scale](#what-would-change-at-scale)
- AI workflow: see [AI_WORKFLOW.md](AI_WORKFLOW.md)

## Architecture Overview

```mermaid
flowchart TD
    Client([HTTP client]) --> Pipe[Global ValidationPipe<br/>class-validator DTOs]
    Pipe --> WC[Workouts module<br/>bulk log, history]
    Pipe --> PC[Personal Records module<br/>PRs + period comparison]

    WC --> ER[Exercise resolver<br/>name → exerciseId, auto-create]
    WC --> UC[Unit conversion registry<br/>kg, lb, …]
    PC --> UC
    PC --> ER
    PC --> PRC[PR calculator<br/>max weight, volume, Epley 1RM]

    WC --> DB[(PostgreSQL)]
    PC --> DB
    ER --> DB

    Seeds[Seed scripts<br/>src/db/seeds] -. exercise / muscle group data .-> DB
    Filter[Global exception filter] -. structured errors .-> Client
```

**Layers:** Controller → Service → Repository / DataSource → Entity. Controllers only handle HTTP concerns, services hold business logic, and pure logic (unit conversion, PR formulas, cursor encoding) lives in plain utility functions that are unit-tested without a database. Only logic with dependencies, like the exercise resolver, is an injectable provider.

**Cross-cutting:**
- **Validation** — a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) rejects malformed input before it reaches a service.
- **Errors** — a global exception filter returns one error shape for every failure (see [Errors](#errors)).
- **Logging** — Winston via `nest-winston`, JSON output in production, one log line per request with method, path, status and duration.
- **Configuration** — `@nestjs/config` with typed, namespaced config (`src/config/`); every value comes from environment variables.

**Why NestJS:** dependency injection makes database-backed pieces (repositories, the exercise resolver) easy to mock in tests, and its module system maps cleanly onto the feature boundaries.

## Setup

### Option 1: Docker Compose (recommended)

```bash
docker compose up --build
```

The API is available at `http://localhost:3000` when running locally. Compose sets `NODE_ENV=local`, so the image runs `scripts/local-entrypoint.sh`: it waits for PostgreSQL, applies pending migrations (`npm run migration:run`), runs the seeders in `src/db/seeds/` (`npm run seed:run`), then starts the app in watch mode (`npm run start:dev`).

For hot reload, add `--watch` (Compose 2.22+): every change under `src/` is copied into the container and Nest restarts the app, and a change to `package.json` or `package-lock.json` rebuilds the image. Without `--watch` the container keeps the code it was built with; changes outside `src/` (e.g. `scripts/`, `tsconfig*.json`) always need `docker compose up --build`.

Migrations and seeds run only when the container starts. After adding one, run it in the running container: `docker compose exec everfit-backend npm run migration:run` (or `seed:run`). With `--watch` the new file is already there; without it, run `docker compose up --build` instead.

### Option 2: Manual setup

**Prerequisites:** Node.js 22+, PostgreSQL 16+

```bash
npm install
createdb everfit
cp .env.example .env         
npm run migration:run
npm run seed:run
npm run start:dev
```

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `local` | Environment name (`local`, `dev`, `test`, `production`), included in every log line |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | PostgreSQL connection |
| `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` | `everfit` / `everfit_password` / `everfit` | PostgreSQL credentials |
| `DB_LOGGING` | `false` | `true` prints every SQL query TypeORM runs (to the console, not through Winston) |
| `LOG_LEVEL` | `info` | Winston log level (`error`, `warn`, `info`, `debug`, `verbose`) |

Outside local Docker, run `npm run migration:run` as a deploy step before starting the app: the app never runs migrations itself, so replicas never race on schema changes.

### Running tests

```bash
npm test                    # unit tests, no database needed
npm run test:integration    # integration tests against the running app
```

Integration tests are black-box: they send HTTP requests to the app that is already running, so start it first (`docker compose up --build --watch`). Requests go to `http://localhost:${PORT}` (override with `INTEGRATION_TEST_BASE_URL`), and the tests open their own connection to the database in `.env` to seed and check data.

Tests and the app share that database. **The tests empty every entity table** before each test and when they finish (the migration history is kept); run `npm run seed:run` afterwards to restore the seed data. The schema is whatever migrations the app container applied on start, so after adding a migration run `docker compose restart everfit-backend` before testing. When a test gets a 500, the stack trace is in `docker compose logs everfit-backend`.

## API Documentation

### POST /workouts — Bulk log workout entries

Log one or more workout entries for a client. Each entry records one exercise performed at a point in time, with one or more sets.

**Request body:**

```json
{
  "userId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "entries": [
    {
      "exerciseName": "bench press",
      "performedAt": "2026-11-17T08:30:00+07:00",
      "sets": [
        { "reps": 10, "weight": 60, "unit": "KG" },
        { "reps": 8, "weight": 135, "unit": "lb" }
      ]
    },
    {
      "exerciseName": "    Farmer    CaRRy     ",
      "performedAt": "2026-11-17T08:50:00+07:00",
      "sets": [{ "reps": 1, "weight": 70, "unit": "lb" }]
    }
  ]
}
```

| Field | Type | Rules |
| --- | --- | --- |
| `userId` | UUID | Required |
| `entries` | array | Required, at least one entry |
| `entries[].exerciseName` | string | Required, max 100 chars. Trimmed and whitespace-collapsed. Unknown names are auto-created |
| `entries[].performedAt` | string | Required. ISO 8601 date-time with a timezone offset (`Z` or `±hh:mm`). Future dates are allowed |
| `entries[].sets` | array | Required, at least one set |
| `entries[].sets[].reps` | integer | Required, 1–100 |
| `entries[].sets[].weight` | number | Required, 0–10,000. Stored as `numeric(9,3)` — PostgreSQL rounds to 3 decimal places |
| `entries[].sets[].unit` | string | Required. Case-insensitive; stored as lowercase. Currently: `kg`, `lb` |

**Body size limit:** 50 KB. A larger request gets `413 Payload Too Large`.

**201 Created:**

```json
{
  "data": [
    {
      "id": "0b6f…",
      "userId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "exerciseName": "Bench Press",
      "performedAt": "2026-11-17T01:30:00.000Z",
      "createdAt": "2026-11-17T09:12:03.412Z",
      "sets": [
        { "id": "a1…", "setOrder": 1, "reps": 10, "weight": 60, "unit": "kg", "weightKg": 60 },
        { "id": "a2…", "setOrder": 2, "reps": 8, "weight": 135, "unit": "lb", "weightKg": 61.235 }
      ]
    },
    {
      "id": "4d2e…",
      "userId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "exerciseName": "Farmer Carry",
      "performedAt": "2026-11-17T01:50:00.000Z",
      "createdAt": "2026-11-17T09:12:03.412Z",
      "sets": [
        { "id": "b1…", "setOrder": 1, "reps": 1, "weight": 70, "unit": "lb", "weightKg": 31.751 }
      ]
    }
  ]
}
```

- `exerciseName` in the response is the stored name: if "Bench Press" already exists and the client sends `bench press`, the response says `Bench Press`.
- `performedAt` is returned in UTC (`…Z`), regardless of the offset the client sent.
- `setOrder` starts at 1 and follows the array order the client sent.
- `weightKg` is `weight × factor`, rounded half-up to 3 decimals (the column's scale).

**400 Bad Request:**

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "entries.0.sets.1.reps must be a positive integer",
    "entries.0.sets.1.unit must be one of: kg, lb",
    "entries.1.performedAt must be an ISO 8601 date-time with a timezone offset (Z or ±hh:mm)",
    "entries.1 duplicates entries.0 (same exerciseName and performedAt)"
  ],
  "timestamp": "2026-11-17T09:12:03.412Z"
}
```

**409 Conflict** — the same `(userId, exerciseName, performedAt)` already exists:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": ["A workout entry for this user, exercise and performedAt already exists"],
  "timestamp": "2026-11-17T09:12:03.412Z"
}
```

If two entries in the same request share `(exerciseName, performedAt)` (case-insensitive, by UTC instant), the response is 400 instead.

#### Exercise resolution and concurrent writes

Clients send `exerciseName`; the service resolves it to an `exerciseId`:
1. Match case-insensitively against the `exercises` table (unique expression index on `LOWER(name)`).
2. If no match, `INSERT … ON CONFLICT DO NOTHING` + re-select: the exercise is auto-created.
3. Two concurrent requests creating the same new exercise both succeed — only one row is created.

#### Duplicate rule

A unique composite index on `(userId, exerciseId, performedAt)` enforces that an entry for a given user and exercise at a given instant is logged exactly once. A duplicate in the database returns 409; a duplicate within one request returns 400. Two sessions of the same exercise on the same day are fine as long as they have different `performedAt` times.

#### Atomicity

The entire request is wrapped in a single PostgreSQL transaction. If any entry fails (e.g. a duplicate), nothing is written — entries, sets, and auto-created exercises are all rolled back.

### GET /workouts — Workout history

List workout entries for a user, with optional filtering, unit conversion, and cursor-based pagination.

**Query parameters:**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `userId` | UUID | Yes | The user whose history to fetch |
| `exerciseName` | string | No | Partial match (case-insensitive). `"bench"` matches "Bench Press" |
| `muscleGroup` | string | No | Exact match (case-insensitive) on the exercise's muscle groups |
| `from` | ISO 8601 | No | Include entries at or after this time |
| `to` | ISO 8601 | No | Include entries at or before this time |
| `unit` | string | No | Return weights in this unit (`kg`, `lb`). Default: `kg` |
| `limit` | integer | No | Page size, 1–50. Default: 10 |
| `cursor` | string | No | Opaque cursor from a previous response's `pagination.cursor` |

**200 OK:**

```json
{
  "data": [
    {
      "id": "0b6f…",
      "userId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "exerciseName": "Bench Press",
      "performedAt": "2026-11-17T01:30:00.000Z",
      "createdAt": "2026-11-17T09:12:03.412Z",
      "sets": [
        { "id": "a1…", "setOrder": 1, "reps": 10, "weight": 60, "unit": "kg", "weightKg": 60 },
        { "id": "a2…", "setOrder": 2, "reps": 8, "weight": 135, "unit": "kg", "weightKg": 61.235 }
      ]
    }
  ],
  "pagination": {
    "limit": 10,
    "cursor": "eyJwZXJmb3JtZWRBdCI6Ii…"
  }
}
```

- Results are ordered by `performedAt` descending (newest first), with `id` as a tiebreaker.
- `weight` is converted to the requested `unit`; `weightKg` is always the stored normalized value.
- When `cursor` is `null`, there are no more pages.
- An empty date range returns 200 with an empty `data` array, not an error.

**400 Bad Request** — invalid `userId`, unsupported `unit`, malformed `cursor`, or `limit` out of range.

### GET /personal-records — Personal records

For a given user and exercise, return the heaviest single set, highest volume set, and best estimated 1RM. Optionally compare two time periods.

**Query parameters:**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `userId` | UUID | Yes | The user whose PRs to fetch |
| `exerciseName` | string | Yes | Exact match (case-insensitive) |
| `unit` | string | No | Return PR values in this unit (`kg`, `lb`). Default: `kg` |
| `from` | ISO 8601 | Conditional | Start of the current period. Required when `compareFrom` is provided |
| `to` | ISO 8601 | Conditional | End of the current period. Required when `compareTo` is provided |
| `compareFrom` | ISO 8601 | No | Start of the comparison period (requires `from`/`to`) |
| `compareTo` | ISO 8601 | No | End of the comparison period (requires `from`/`to`) |

When `from`/`to` are omitted and no comparison is requested, PRs are computed over all time.

**200 OK:**

```json
{
  "data": {
    "exerciseName": "Bench Press",
    "unit": "kg",
    "current": {
      "heaviestSet": { "value": 100, "date": "2026-11-17T08:00:00.000Z" },
      "highestVolume": { "value": 600, "date": "2026-11-15T08:00:00.000Z" },
      "bestEstimated1RM": { "value": 110, "date": "2026-11-17T08:00:00.000Z" }
    },
    "previous": {
      "heaviestSet": { "value": 70, "date": "2026-10-10T08:00:00.000Z" },
      "highestVolume": { "value": 560, "date": "2026-10-10T08:00:00.000Z" },
      "bestEstimated1RM": { "value": 88.667, "date": "2026-10-10T08:00:00.000Z" }
    }
  }
}
```

- **`heaviestSet`** — the set with the highest weight.
- **`highestVolume`** — the set with the highest `reps x weight`.
- **`bestEstimated1RM`** — the set with the highest Epley estimate: `weight x (1 + reps / 30)`.
- Each PR includes the `date` it was achieved. When a tie occurs, the earliest date wins.
- `previous` is `null` when no comparison period is requested. Individual PR fields are `null` when no data exists in that period.

**400 Bad Request** — missing `userId`/`exerciseName`, unknown exercise name, unsupported `unit`, `from` must be before `to`, or `compareFrom`/`compareTo` provided without `from`/`to`.

### Errors

Every error response has the same shape, produced by a global exception filter:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["sets.0.reps must be a positive number"],
  "timestamp": "2026-01-15T10:00:00.000Z"
}
```

- `message` is **always an array**, even when there is a single message.
- Unknown request properties are rejected (`property foo should not exist`).
- 5xx responses never expose internals: the body is `["Internal server error"]` and the stack is logged server-side.

| Status | When |
| --- | --- |
| `200` | Successful retrieval (GET) or update (PATCH) |
| `201` | Successful creation (POST) |
| `400` | Validation error, malformed JSON, malformed cursor |
| `404` | Resource or route not found |
| `409` | Conflicting state |
| `500` | Unexpected server error |

## Database Schema

```mermaid
erDiagram
    exercises ||--o{ exercise_muscle_groups : "mapped to"
    muscle_groups ||--o{ exercise_muscle_groups : "mapped to"
    exercises ||--o{ workout_entries : "logged as"
    workout_entries ||--|{ exercise_sets : contains

    exercises {
        uuid id PK
        varchar name "unique on LOWER(name)"
        timestamptz createdAt
    }
    muscle_groups {
        uuid id PK
        varchar name "unique on LOWER(name)"
        timestamptz createdAt
    }
    exercise_muscle_groups {
        uuid exerciseId PK,FK
        uuid muscleGroupId PK,FK
    }
    workout_entries {
        uuid id PK
        uuid userId
        uuid exerciseId FK
        timestamptz performedAt
        timestamptz createdAt
    }
    exercise_sets {
        uuid id PK
        uuid workoutEntryId FK
        smallint setOrder
        int reps
        numeric weight "9,3 - original"
        varchar unit "original"
        numeric weightKg "9,3 - normalized"
        timestamptz createdAt
    }
```

**`workout_entries`** — one row per exercise performed by a user at a point in time.
- `exerciseId` is a foreign key with `ON DELETE RESTRICT`: an exercise with history can't be deleted.
- Clients send `exerciseName`; the service resolves it to `exerciseId` (see [Exercise resolution](#exercise-resolution-and-concurrent-writes)).

**`exercise_sets`** — the individual sets of an entry.
- `ON DELETE CASCADE` from `workout_entries`; sets never exist without their entry.
- Stores the original `weight`/`unit` and the normalized `weightKg`.
- CHECK constraints back up DTO validation: `reps > 0`, `weight >= 0`, `weightKg >= 0`, `setOrder >= 1`.

**`exercises`, `muscle_groups`, `exercise_muscle_groups`** — the exercise catalog.
- Names are unique case-insensitively (unique expression index on `LOWER(name)`), so "Bench Press" and "bench press" are one exercise.
- Many-to-many: Bench Press → chest, triceps, shoulders. The join table uses a composite primary key.

### Indexing Strategy

Every index targets a specific access pattern in the API:

| Index | Type | Table | Serves |
| --- | --- | --- | --- |
| `UQ_workout_entries_user_exercise_performed` | Unique B-tree on `(userId, exerciseId, performedAt)` | `workout_entries` | Duplicate prevention (409 on conflict); also the primary lookup path for history and PRs — the leading `userId` column satisfies the `WHERE userId = ?` that every query starts with |
| `UQ_exercise_sets_entry_order` | Unique B-tree on `(workoutEntryId, setOrder)` | `exercise_sets` | Guarantees set ordering uniqueness per entry; doubles as the join index when loading sets for an entry |
| `UQ_exercises_name_lower` | Unique expression on `LOWER(name)` | `exercises` | Case-insensitive name resolution (`LOWER(name) = LOWER(?)`) and auto-create idempotency (`INSERT ... ON CONFLICT DO NOTHING`) |
| `UQ_muscle_groups_name_lower` | Unique expression on `LOWER(name)` | `muscle_groups` | Same pattern for muscle group seeds |
| `IDX_exercise_muscle_groups_exerciseId` | B-tree on `exerciseId` | `exercise_muscle_groups` | Join from exercises to muscle groups (muscle group filter on GET /workouts) |
| `IDX_exercise_muscle_groups_muscleGroupId` | B-tree on `muscleGroupId` | `exercise_muscle_groups` | Reverse lookup — which exercises belong to a muscle group |
| Primary keys (`id`) | B-tree | all tables | Point lookups and FK enforcement |

**Design rationale:**

- The composite index on `workout_entries` is ordered `(userId, exerciseId, performedAt)` so that both history queries (filter by user, optionally by exercise, ordered by date) and PR queries (filter by user + exercise, scan sets) can use an index range scan without a sort step.
- Expression indexes on `LOWER(name)` avoid storing a separate lowercase column while still giving the query planner an exact index match for case-insensitive lookups.
- No separate index on `exercise_sets.workoutEntryId` alone — the unique composite `(workoutEntryId, setOrder)` already has `workoutEntryId` as its leading column, so the FK join uses it.
- Cursor pagination uses `(performedAt, id)` as the keyset. The composite index covers `performedAt` ordering within a user, and the PK covers the `id` tiebreaker.

### Why PostgreSQL

1. **Relational data** — entries → sets and exercises ↔ muscle groups are naturally relational, with foreign keys and CHECK constraints enforcing integrity.
2. **Aggregations** — PRs are computed over a filtered join (SQL does the `WHERE` + date range), and the final pick-best logic runs in a pure utility (`pr-calculator.ts`) with `numeric` precision preserved from the database.
3. **Transactions** — bulk logging is atomic across many rows and tables.
4. **Indexing** — composite B-tree indexes match the access patterns exactly, and expression indexes give case-insensitive uniqueness.

## Design Decisions & Trade-offs

### Duplicate rule

A unique index on `(userId, exerciseId, performedAt)` enforces that one entry per user, exercise and instant exists. The rule uses the exact UTC instant, not a calendar day, because the server doesn't know the client's timezone. A consequence: if a client always sends midnight, the second session of the same exercise that day gets a 409. The mitigation is to send the real time, documented in the API section above.

### Timezone handling

`performedAt` requires an ISO 8601 date-time with an explicit timezone offset. Values without an offset (like `2026-11-17T08:30:00`) are rejected with 400 — the server never assumes a timezone. The value is stored as `timestamptz` (a UTC instant). The client's original offset is not stored: anything that needs local days or weeks (history ranges, PR period comparisons) must have the client send range boundaries as instants. The upside is one unambiguous timeline with no server-side timezone logic.

## What Would Change at Scale

**When MongoDB could make sense** — at global scale with millions of users, MongoDB's built-in sharding (with Zone Sharding for regional data placement) distributes data across nodes and regions out of the box, whereas PostgreSQL's native horizontal sharding requires an extension such as Citus or a distributed Postgres-compatible database. However, it comes at a real cost for this domain: no foreign key constraints (referential integrity must be maintained in application code), unique indexes on sharded collections that must be prefixed by the shard key (so global uniqueness on fields like name or email isn't enforceable across shards), and multi-document transactions that carry a performance penalty, with added complexity when they span shards. For the current assignment requirements and relational shape of the data (entries → sets, exercises ↔ muscle groups, transactional bulk inserts), PostgreSQL's guarantees outweigh MongoDB's scaling convenience.

**Caching PRs** — personal records change only when new workout data is logged. A cache (Redis) keyed on `(userId, exerciseId)` with invalidation on write would eliminate repeated computation. The PR response is small and deterministic for the same data, making it an ideal cache candidate.

**Rate limiting and request queuing** — bulk logging can be expensive (transaction with multiple inserts). A rate limiter per `userId` and a request queue would prevent a single client from saturating the database connection pool.

