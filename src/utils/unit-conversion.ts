import { UNIT_TO_KG, type WeightUnit } from '@/const/unit';

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Converts a weight value to kilograms, rounded half-up to 3 decimal places.
 *
 * @param weight - The weight value in the original unit.
 * @param unit - The source unit (e.g. `'kg'`, `'lb'`).
 * @returns The equivalent weight in kilograms.
 * @throws {Error} If the unit is not in the conversion registry.
 */
export function toKg(weight: number, unit: WeightUnit): number {
  const factor = UNIT_TO_KG[unit];
  if (factor === undefined) {
    throw new Error(`Unsupported weight unit: ${String(unit)}`);
  }
  return round3(weight * factor);
}

/**
 * Converts a weight from kilograms to the specified unit, rounded to three
 * decimal places. This is the inverse of {@link toKg} and is used when
 * returning weights to the client in their requested unit.
 *
 * @param weightKg - The weight in kilograms (the normalized storage value).
 * @param unit - The target unit to convert to (e.g. `'lb'`, `'kg'`).
 * @returns The converted weight, rounded to three decimal places.
 * @throws {Error} If the unit is not present in the conversion registry.
 */
export function fromKg(weightKg: number, unit: WeightUnit): number {
  const factor = UNIT_TO_KG[unit];
  if (factor === undefined) {
    throw new Error(`Unsupported weight unit: ${String(unit)}`);
  }
  return round3(weightKg / factor);
}
