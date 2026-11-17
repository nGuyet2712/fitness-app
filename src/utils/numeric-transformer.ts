import type { ValueTransformer } from 'typeorm';

/**
 * Column transformer for PostgreSQL `numeric` columns: `pg` returns `numeric`
 * values as strings (to avoid precision loss), so this converts them back to
 * numbers. Values up to `numeric(9,3)` fit a JS number exactly enough.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};
