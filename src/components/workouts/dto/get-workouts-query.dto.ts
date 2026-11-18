import { SUPPORTED_UNITS, type WeightUnit } from '@/const/unit';
import { MAX_LIMIT, MIN_LIMIT, MIN_NAME_LENGTH } from '@/const/workout';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class GetWorkoutsQueryDto {
  @IsUUID('4', { message: 'userId must be a UUID' })
  userId: string;

  @IsOptional()
  @IsString({ message: 'exerciseName must be a string' })
  @MinLength(MIN_NAME_LENGTH, { message: 'exerciseName must not be empty' })
  exerciseName?: string;

  @IsOptional()
  @IsString({ message: 'muscleGroup must be a string' })
  @MinLength(MIN_NAME_LENGTH, { message: 'muscleGroup must not be empty' })
  muscleGroup?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'from must be an ISO 8601 date-time' })
  from?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'to must be an ISO 8601 date-time' })
  to?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(SUPPORTED_UNITS, {
    message: `unit must be one of: ${SUPPORTED_UNITS.join(', ')}`,
  })
  unit?: WeightUnit;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  @IsInt({ message: 'limit must be an integer' })
  @Min(MIN_LIMIT, { message: `limit must be at least ${MIN_LIMIT}` })
  @Max(MAX_LIMIT, { message: `limit must be at most ${MAX_LIMIT}` })
  limit?: number;

  @IsOptional()
  @IsString({ message: 'cursor must be a string' })
  cursor?: string;
}
