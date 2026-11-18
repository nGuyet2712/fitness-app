import { round3 } from '@/utils/unit-conversion';
import { PersonalRecord, SetRow } from '../personal-records.types';

function pickBest(
  rows: SetRow[],
  metric: (row: SetRow) => number,
): PersonalRecord | null {
  if (rows.length === 0) return null;

  let currentBest = rows[0];
  let bestValue = metric(currentBest);

  for (const row of rows) {
    const score = metric(row);
    if (
      score > bestValue ||
      (score === bestValue && row.performedAt < currentBest.performedAt)
    ) {
      currentBest = row;
      bestValue = score;
    }
  }

  return {
    value: round3(bestValue),
    date: currentBest.performedAt.toISOString(),
  };
}

export function heaviestSet(rows: SetRow[]): PersonalRecord | null {
  return pickBest(rows, (r) => r.weightKg);
}

export function highestVolume(rows: SetRow[]): PersonalRecord | null {
  return pickBest(rows, (r) => r.reps * r.weightKg);
}

export function bestEstimated1RM(rows: SetRow[]): PersonalRecord | null {
  return pickBest(rows, (r) => r.weightKg * (1 + r.reps / 30));
}
