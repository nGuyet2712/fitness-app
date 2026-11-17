import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreateWorkoutsDto } from './dto/create-workouts.dto';
import { WorkoutsService } from './workouts.service';

@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateWorkoutsDto) {
    const data = await this.workoutsService.bulkCreate(dto);
    return { data };
  }
}
