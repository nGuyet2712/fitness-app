# AI Workflow Log

## Tools Used

| Tool | Purpose |
|------|---------|
| **Claude Code (CLI)** | Primary coding assistant — architecture design, implementation, test writing, debugging, documentation |
| **Claude (chat)** | Brainstorming API design decisions, reviewing trade-offs (pagination strategy, timezone handling, duplicate rules) |

### How I used AI across the project

- **Architecture & schema design** — discussed entity relationships, indexing strategy, and normalization approach (storing `weightKg` alongside original `weight`/`unit`) before writing any code.
- **Implementation** — used /implementation-plan command to generate plan for code (modules, controllers, DTOs) at each files, then iterated on the business logic (exercise resolution, bulk insert transactions, PR computation) to meet acceptance criteria.
- **Testing** — generated unit and integration test scaffolding, then refined assertions and edge cases (concurrent writes, in-payload duplicates, malformed cursors).
- **Debugging** — used AI to diagnose ESM/CJS interop issues with Jest + NestJS 12, TypeORM numeric-as-string column behavior, and cursor pagination off-by-one errors.
- **Documentation** — generated README structure and API docs, then reviewed and corrected details.

## AI Corrections (output was wrong or suboptimal)

### 1. PR calculator doing aggregation in JavaScript instead of SQL

Claude initially suggested fetching all sets for a user+exercise and computing PRs (max weight, highest volume, best 1RM) entirely in JavaScript with `Array.reduce()`. This would have been a performance problem at scale — scanning 50,000+ sets in memory on every request. I redirected to have the repository fetch the raw set rows with SQL filtering (date range, user, exercise) and only run the lightweight `pickBest` logic on the filtered result. The SQL query does the heavy lifting (joins, WHERE clauses), and the JS layer just picks the winner from the already-filtered rows.

### 2. Exercise resolution with a race condition

Claude's first version of exercise auto-creation used findOne → if null → save(). Two concurrent requests for the same new exercise name could both pass the findOne check and both try to insert, with one hitting the unique index and crashing with a 500. I replaced this with INSERT ... ON CONFLICT DO NOTHING followed by a re-select, so concurrent requests for the same name both succeed and only one row is created.

## Rejected AI Suggestion

### Redundant DB schema design

Claude suggested create a column named `idempotencyKey` for bulk workout logging to prevent duplicate inserts. I rejected this because:
- The API already deduplicates entries by `(userId, exerciseId, timestamp, weight, reps)` before inserting, so a separate key is unnecessary.
- Adding an idempotency column would require additional indexing and storage, increasing complexity without benefit. The deduplication logic in the service layer is sufficient for the use case.

## Prompting Strategy

- **Rules files as system context** — created `.claude/rules/` with detailed patterns for API design, TypeORM usage, testing, and coding guidelines. This gave the AI consistent context across every prompt without repeating instructions.
- **Iterative, feature-scoped prompts** — broke the project into features (bulk logging, workout history, personal records) and worked through each one end-to-end (entity → migration → service → controller → tests) before moving to the next.
- **Review-then-refine** — never accepted generated code blindly. Read every diff, ran tests, and pushed back when the output didn't match the project's conventions (e.g. extensionless imports, CommonJS compatibility, parameterized queries).
- **Context-rich corrections** — when correcting AI output, explained *why* (e.g. "this needs to be a parameterized query because of SQL injection, not just for style"), so subsequent prompts produced better results without repeating the correction.
