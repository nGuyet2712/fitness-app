import { SUPPORTED_UNITS, UNIT_TO_KG, type WeightUnit } from '@/const/unit';
import { toKg } from '@/utils/unit-conversion';
import { MAX_WEIGHT } from '@/const/workout';

describe('unit-conversion', () => {
  describe('SUPPORTED_UNITS', () => {
    it('should match the keys of UNIT_TO_KG', () => {
      expect([...SUPPORTED_UNITS].sort()).toEqual(
        Object.keys(UNIT_TO_KG).sort(),
      );
    });
  });

  describe('MAX_WEIGHT', () => {
    it('should not overflow numeric(9,3) when multiplied by the largest factor', () => {
      const maxFactor = Math.max(...Object.values(UNIT_TO_KG));
      expect(MAX_WEIGHT * maxFactor).toBeLessThan(1_000_000);
    });
  });

  describe('toKg', () => {
    it('should return the same value when unit is kg', () => {
      expect(toKg(100, 'kg')).toBe(100);
    });

    it('should return 0 when weight is 0 regardless of unit', () => {
      for (const unit of SUPPORTED_UNITS) {
        expect(toKg(0, unit)).toBe(0);
      }
    });

    it('should convert 100 lb to 45.359 kg', () => {
      expect(toKg(100, 'lb')).toBe(45.359);
    });

    it('should convert 135 lb to 61.235 kg (round half-up)', () => {
      expect(toKg(135, 'lb')).toBe(61.235);
    });

    it('should convert 1 lb to 0.454 kg', () => {
      expect(toKg(1, 'lb')).toBe(0.454);
    });

    it('should round to exactly 3 decimal places', () => {
      for (const unit of SUPPORTED_UNITS) {
        const result = toKg(123.456, unit);
        const decimals = result.toString().split('.')[1]?.length ?? 0;
        expect(decimals).toBeLessThanOrEqual(3);
      }
    });

    it('should throw for an unsupported unit', () => {
      expect(() => toKg(100, 'stone' as WeightUnit)).toThrow(
        'Unsupported weight unit: stone',
      );
    });
  });
});
