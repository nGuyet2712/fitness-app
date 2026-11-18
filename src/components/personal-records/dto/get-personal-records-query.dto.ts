import { SUPPORTED_UNITS, type WeightUnit } from '@/const/unit';
import { MIN_NAME_LENGTH } from '@/const/workout';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'dateRange' })
class DateRangeConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const obj = args.object as GetPersonalRecordsQueryDto;
    const fromField = args.constraints[0] as 'from' | 'compareFrom';
    const toField = args.constraints[1] as 'to' | 'compareTo';
    const from = obj[fromField];
    const to = obj[toField];
    if (!from || !to) return true;
    return new Date(from) < new Date(to);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.constraints[0] as string} must be before ${args.constraints[1] as string}`;
  }
}

export class GetPersonalRecordsQueryDto {
  @IsUUID('4', { message: 'userId must be a UUID' })
  userId: string;

  @IsString({ message: 'exerciseName must be a string' })
  @IsNotEmpty({ message: 'exerciseName must not be empty' })
  @MinLength(MIN_NAME_LENGTH, { message: 'exerciseName must not be empty' })
  exerciseName: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(SUPPORTED_UNITS, {
    message: `unit must be one of: ${SUPPORTED_UNITS.join(', ')}`,
  })
  unit?: WeightUnit;

  @ValidateIf((o) => o.from !== undefined || o.compareFrom !== undefined)
  @IsNotEmpty({ message: 'from is required when compareFrom is provided' })
  @IsISO8601({}, { message: 'from must be an ISO 8601 date-time' })
  @Validate(DateRangeConstraint, ['from', 'to'])
  from?: string;

  @ValidateIf((o) => o.to !== undefined || o.compareTo !== undefined)
  @IsNotEmpty({ message: 'to is required when compareTo is provided' })
  @IsISO8601({}, { message: 'to must be an ISO 8601 date-time' })
  to?: string;

  @ValidateIf((o) => o.compareFrom !== undefined || o.compareTo !== undefined)
  @IsNotEmpty({ message: 'compareFrom is required when compareTo is provided' })
  @IsISO8601({}, { message: 'compareFrom must be an ISO 8601 date-time' })
  @Validate(DateRangeConstraint, ['compareFrom', 'compareTo'])
  compareFrom?: string;

  @ValidateIf((o) => o.compareTo !== undefined || o.compareFrom !== undefined)
  @IsNotEmpty({ message: 'compareTo is required when compareFrom is provided' })
  @IsISO8601({}, { message: 'compareTo must be an ISO 8601 date-time' })
  compareTo?: string;
}
