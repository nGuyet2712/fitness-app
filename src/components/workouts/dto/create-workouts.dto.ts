import { SUPPORTED_UNITS, type WeightUnit } from '@/const/unit';
import {
  MAX_REP,
  MIN_REP,
  MIN_WEIGHT,
  MAX_WEIGHT,
  MAX_NAME_LENGTH,
} from '@/const/workout';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Normalise an exercise name for consistent storage.
 *
 * 1. Trims leading/trailing whitespace.
 * 2. Collapses repeated inner whitespace to a single space.
 * 3. Title-cases each word (first letter upper, rest lower).
 *
 * @example
 * normaliseExerciseName('  bench   PRESS  ') // → 'Bench Press'
 */
const normaliseExerciseName = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(
      /\S+/g,
      (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    );
};

export class CreateSetDto {
  @IsInt({ message: 'reps must be a positive integer' })
  @Min(MIN_REP, { message: 'reps must be at least ${MIN_REP}' })
  @Max(MAX_REP, { message: 'reps must be at most ${MAX_REP}' })
  reps: number;

  @IsNumber({}, { message: 'weight must be a number' })
  @Min(MIN_WEIGHT, { message: 'weight must be at least ${MIN_WEIGHT}' })
  @Max(MAX_WEIGHT, {
    message: `weight must be at most ${MAX_WEIGHT}`,
  })
  weight: number;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsString({ message: `unit must be one of: ${SUPPORTED_UNITS.join(', ')}` })
  @IsIn(SUPPORTED_UNITS, {
    message: `unit must be one of: ${SUPPORTED_UNITS.join(', ')}`,
  })
  unit: WeightUnit;
}

export class CreateEntryDto {
  @Transform(({ value }) => normaliseExerciseName(value))
  @IsString({ message: 'exerciseName must be a string' })
  @IsNotEmpty({ message: 'exerciseName must not be empty' })
  @MaxLength(MAX_NAME_LENGTH, {
    message: 'exerciseName must be at most ${MAX_NAME_LENGTH} characters',
  })
  exerciseName: string;

  @IsNotEmpty({
    message: 'performedAt must not be empty',
  })
  @IsISO8601(
    { strict: true },
    {
      message: 'performedAt must be an ISO 8601 date-time',
    },
  )
  @Matches(/([Zz]|[+-]\d{2}:\d{2})$/, {
    message: 'performedAt must have timezone offset',
  })
  performedAt: string;

  @IsArray({ message: 'sets must be an array' })
  @ArrayNotEmpty({ message: 'sets must not be empty' })
  @ValidateNested({ each: true })
  @Type(() => CreateSetDto)
  sets: CreateSetDto[];
}

export class CreateWorkoutsDto {
  @IsUUID('4', { message: 'userId must be a UUID' })
  userId: string;

  @IsArray({ message: 'entries must be an array' })
  @ArrayNotEmpty({ message: 'entries must not be empty' })
  @ValidateNested({ each: true })
  @Type(() => CreateEntryDto)
  entries: CreateEntryDto[];
}
