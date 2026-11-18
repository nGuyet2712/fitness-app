import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SUPPORTED_UNITS, type WeightUnit } from '@/const/unit';
import { ExercisesRepository } from '@/components/exercises/exercises.repository';
import { fromKg } from '@/utils/unit-conversion';
import type { GetPersonalRecordsQueryDto } from './dto/get-personal-records-query.dto';
import { PersonalRecordsRepository } from './personal-records.repository';
import {
  bestEstimated1RM,
  heaviestSet,
  highestVolume,
} from './utils/pr-calculator';
import { PersonalRecord, PrBlock, SetRow } from './personal-records.types';

@Injectable()
export class PersonalRecordsService {
  private readonly logger = new Logger(PersonalRecordsService.name);

  constructor(
    private readonly personalRecordsRepository: PersonalRecordsRepository,
    private readonly exercisesRepository: ExercisesRepository,
  ) {}

  async getPersonalRecords(query: GetPersonalRecordsQueryDto) {
    const exercise = await this.exercisesRepository.findByName(
      query.exerciseName,
    );
    if (!exercise) {
      throw new BadRequestException(
        `Unknown exercise name: ${query.exerciseName}`,
      );
    }

    const unit: WeightUnit = query.unit ?? SUPPORTED_UNITS[0];

    const setRows = await this.personalRecordsRepository.findSetRows({
      userId: query.userId,
      exerciseId: exercise.id,
      from: query.from,
      to: query.to,
    });
    const current = this.computePrs(setRows, unit);

    let previous: PrBlock | null = null;
    if (query.compareFrom || query.compareTo) {
      const previousRows = await this.personalRecordsRepository.findSetRows({
        userId: query.userId,
        exerciseId: exercise.id,
        from: query.compareFrom,
        to: query.compareTo,
      });
      previous = this.computePrs(previousRows, unit);
    }

    this.logger.log(
      `PR lookup for user ${query.userId}, exercise "${exercise.name}"`,
    );

    return {
      data: {
        exerciseName: exercise.name,
        unit,
        current,
        previous,
      },
    };
  }

  private computePrs(rows: SetRow[], unit: WeightUnit): PrBlock {
    const convert = (pr: PersonalRecord | null): PersonalRecord | null =>
      pr ? { value: fromKg(pr.value, unit), date: pr.date } : null;

    return {
      heaviestSet: convert(heaviestSet(rows)),
      highestVolume: convert(highestVolume(rows)),
      bestEstimated1RM: convert(bestEstimated1RM(rows)),
    };
  }
}
