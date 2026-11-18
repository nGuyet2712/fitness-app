import { Controller, Get, Query } from '@nestjs/common';
import { GetPersonalRecordsQueryDto } from './dto/get-personal-records-query.dto';
import { PersonalRecordsService } from './personal-records.service';

@Controller('personal-records')
export class PersonalRecordsController {
  constructor(
    private readonly personalRecordsService: PersonalRecordsService,
  ) {}

  @Get()
  async getPersonalRecords(@Query() query: GetPersonalRecordsQueryDto) {
    return this.personalRecordsService.getPersonalRecords(query);
  }
}
