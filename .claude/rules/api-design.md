# REST API Design Standards

## URL Conventions

- Resource-based, plural URLs: `/workouts`, `/personal-records`
- Use kebab-case for multi-word URL segments
- Query params for filtering, pagination, and unit selection
- Exercises are referenced by `exerciseName` in requests, never by `exerciseId`. The service resolves the name (see `typeorm.md` → Exercise Resolution)

## Request Validation

- A global `ValidationPipe` runs with `whitelist`, `forbidNonWhitelisted` and `transform`, so unknown properties are rejected with 400
- Every endpoint has a dedicated DTO in `src/components/<feature>/dto/`
- `@IsOptional()` for optional fields/query params, `@IsNotEmpty()` for required ones
- Nested objects: `@ValidateNested({ each: true })` + `@Type(() => ChildDto)`
- Dates arrive as ISO 8601 strings (`@IsISO8601()`); no timezone conversion on the server
- DTO rules must match the DB CHECK constraints: `reps > 0`, `weight >= 0`
- Units are validated against the unit conversion registry, so don't hardcode a second list of units in a DTO
- Unknown exercise names are **valid** when logging: they are auto-created, not rejected

## Pagination

- Cursor-based: clients pass `limit` and an opaque `cursor`; the response returns the cursor for the next page
- Cursor encoding/decoding lives in a generic pure util (`src/utils/cursor.ts`) shared by every list endpoint, with its own unit tests. Each service decides which columns form the keyset
- Cap `limit` in the service layer
- A malformed cursor returns 400
- Empty results return 200 with an empty list, never 404

## Error Responses

A global exception filter returns one error shape for every failure:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["sets.0.reps must be a positive number"],
  "timestamp": "2026-01-15T10:00:00.000Z"
}
```

- 5xx errors are logged with their stack via Winston; the response never leaks internals

## HTTP Status Codes

- `201` — successful creation (POST)
- `200` — successful retrieval (GET) and updates (PATCH)
- `400` — validation errors, malformed cursor
- `404` — resource not found
- `409` — conflicting state
- `500` — unexpected server errors

Duplicate exercise names are **not** a 409, because exercise resolution is case-insensitive and idempotent.
