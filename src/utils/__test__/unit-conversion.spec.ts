import { SUPPORTED_UNITS, type WeightUnit } from '@/const/unit';
import { fromKg, toKg } from '@/utils/unit-conversion';

describe('unit-conversion', () => {
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

  describe('fromKg', () => {
    it('should return the same value when unit is kg', () => {
      expect(fromKg(100, 'kg')).toBe(100);
    });

    it('should return 0 when weightKg is 0 regardless of unit', () => {
      for (const unit of SUPPORTED_UNITS) {
        expect(fromKg(0, unit)).toBe(0);
      }
    });

    it('should convert 60 kg to 132.277 lb', () => {
      expect(fromKg(60, 'lb')).toBe(132.277);
    });

    it('should round-trip through toKg and fromKg for lb', () => {
      expect(fromKg(toKg(135, 'lb'), 'lb')).toBe(135);
    });

    it('should round to exactly 3 decimal places', () => {
      for (const unit of SUPPORTED_UNITS) {
        const result = fromKg(123.456, unit);
        const decimals = result.toString().split('.')[1]?.length ?? 0;
        expect(decimals).toBeLessThanOrEqual(3);
      }
    });

    it('should throw for an unsupported unit', () => {
      expect(() => fromKg(100, 'stone' as WeightUnit)).toThrow(
        'Unsupported weight unit: stone',
      );
    });
  });
});
