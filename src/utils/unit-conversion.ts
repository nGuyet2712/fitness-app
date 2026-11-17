import { UNIT_TO_KG, type WeightUnit } from '../const/unit';

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
  return Math.round(weight * factor * 1000) / 1000;
}
