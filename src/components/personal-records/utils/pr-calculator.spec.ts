import { round3 } from '@/utils/unit-conversion';
import { SetRow } from '../personal-records.types';
import { bestEstimated1RM, heaviestSet, highestVolume } from './pr-calculator';

function row(weightKg: number, reps: number, performedAt: string): SetRow {
  return { weightKg, reps, performedAt: new Date(performedAt) };
}

describe('pr-calculator', () => {
  describe('heaviestSet', () => {
    it('should return null for empty input', () => {
      expect(heaviestSet([])).toBeNull();
    });

    it('should return the set with the highest weightKg', () => {
      const rows = [
        row(60, 10, '2026-11-15T08:00:00Z'),
        row(100, 3, '2026-11-16T08:00:00Z'),
        row(80, 5, '2026-11-17T08:00:00Z'),
      ];

      const result = heaviestSet(rows);

      expect(result).toEqual({
        value: 100,
        date: '2026-11-16T08:00:00.000Z',
      });
    });

    it('should pick the earliest date when weights are tied', () => {
      const rows = [
        row(100, 5, '2026-11-17T08:00:00Z'),
        row(100, 3, '2026-11-15T08:00:00Z'),
        row(100, 8, '2026-11-16T08:00:00Z'),
      ];

      const result = heaviestSet(rows);

      expect(result?.date).toBe('2026-11-15T08:00:00.000Z');
    });
  });

  describe('highestVolume', () => {
    it('should return null for empty input', () => {
      expect(highestVolume([])).toBeNull();
    });

    it('should return the set with the highest reps × weightKg', () => {
      const rows = [
        row(60, 10, '2026-11-15T08:00:00Z'),
        row(100, 3, '2026-11-16T08:00:00Z'),
        row(80, 8, '2026-11-17T08:00:00Z'),
      ];

      const result = highestVolume(rows);

      expect(result).toEqual({
        value: 640,
        date: '2026-11-17T08:00:00.000Z',
      });
    });

    it('should pick the earliest date when volumes are tied', () => {
      const rows = [
        row(100, 6, '2026-11-17T08:00:00Z'),
        row(60, 10, '2026-11-15T08:00:00Z'),
        row(100, 6, '2026-11-14T08:00:00Z'),
      ];

      const result = highestVolume(rows);

      expect(result).toEqual({
        value: 600,
        date: '2026-11-14T08:00:00.000Z',
      });
    });
  });

  describe('bestEstimated1RM', () => {
    it('should return null for empty input', () => {
      expect(bestEstimated1RM([])).toBeNull();
    });

    it('should return the set with the highest estimated 1RM', () => {
      const rows = [
        row(60, 10, '2026-11-15T08:00:00Z'),
        row(100, 3, '2026-11-16T08:00:00Z'),
        row(80, 8, '2026-11-17T08:00:00Z'),
      ];

      const e1rm = (w: number, r: number) => round3(w * (1 + r / 30));

      const result = bestEstimated1RM(rows);
      const expected = Math.max(e1rm(60, 10), e1rm(100, 3), e1rm(80, 8));

      expect(result?.value).toBe(expected);
    });

    it('should pick the earliest date when estimated 1RMs are tied', () => {
      const rows = [
        row(100, 5, '2026-11-17T08:00:00Z'),
        row(100, 5, '2026-11-14T08:00:00Z'),
      ];

      const result = bestEstimated1RM(rows);

      expect(result?.date).toBe('2026-11-14T08:00:00.000Z');
    });
  });
});
