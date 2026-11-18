import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { CreateWorkoutsDto } from './dto/create-workouts.dto';
import { GetWorkoutsQueryDto } from './dto/get-workouts-query.dto';
import { WorkoutsService } from './workouts.service';

@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Get()
  async getWorkouts(@Query() query: GetWorkoutsQueryDto) {
    return this.workoutsService.getWorkouts(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateWorkoutsDto) {
    const data = await this.workoutsService.bulkCreate(dto);
    return { data };
  }
}
