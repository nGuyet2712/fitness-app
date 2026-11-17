import { numericTransformer } from '../numeric-transformer';

describe('numericTransformer', () => {
  describe('from (database → application)', () => {
    it('should convert a numeric string to a number', () => {
      expect(numericTransformer.from('61.235')).toBe(61.235);
    });

    it('should convert an integer string to a number', () => {
      expect(numericTransformer.from('100')).toBe(100);
    });

    it('should convert "0" to 0', () => {
      expect(numericTransformer.from('0')).toBe(0);
    });

    it('should return null when the value is null', () => {
      expect(numericTransformer.from(null)).toBeNull();
    });
  });

  describe('to (application → database)', () => {
    it('should pass a number through unchanged', () => {
      expect(numericTransformer.to(61.235)).toBe(61.235);
    });

    it('should pass null through unchanged', () => {
      expect(numericTransformer.to(null)).toBeNull();
    });

    it('should pass undefined through unchanged', () => {
      expect(numericTransformer.to(undefined)).toBeUndefined();
    });
  });
});
