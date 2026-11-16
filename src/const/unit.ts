export const UNIT_TO_KG = {
  kg: 1,
  lb: 0.45359237,
} as const;

export type WeightUnit = keyof typeof UNIT_TO_KG;

export const SUPPORTED_UNITS: WeightUnit[] = Object.keys(
  UNIT_TO_KG,
) as WeightUnit[];

export const MAX_UNIT_NAME_LENGTH = 100;

export const UNIT_PRECISION = 9;

export const UNIT_SCALE = 3;
