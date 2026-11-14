# /implementation-plan

Generate an implementation plan for a new feature or change in the Everfit API.

## Usage

```
/implementation-plan [description of the feature or change]
```

## Steps

1. Understand the requirement from the description provided.
2. Explore the codebase to identify affected files and existing patterns. Read `CLAUDE.md`, `.claude/rules/` and the entity files in `src/db/entities/` before planning schema changes.
3. Design the implementation approach:
   - Which entities/migrations need changes
   - Which feature modules, controllers, services, DTOs are affected
   - What tests need to be written
4. Present the plan as a numbered task list with:
   - Files to create or modify
   - Key logic for each task
   - Test strategy
5. Do not write or modify any code. Stop after presenting the plan and wait for the user to approve or adjust it.

## Standard Task Order

1. Entity changes in `src/db/entities/` (+ re-export from `index.ts`) and a migration in `src/db/migrations/`
2. DTOs in `src/components/<feature>/dto/`
3. Service (business logic; pure logic in `utils/` functions, `@Injectable()` providers only for logic with dependencies)
4. Controller (HTTP endpoints)
5. Feature module is created in `src/components/<feature>/<feature>.module.ts` (for a new feature) and registered in `src/app.module.ts`
6. Unit tests (`src/**/*.spec.ts`, `npm test`)
7. Integration tests (`__test__/**/*.spec.ts`, `npm run test:integration`)
8. README updates (API docs, schema, design decisions)
