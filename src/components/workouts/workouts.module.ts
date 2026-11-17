import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExercisesModule } from '../exercises/exercises.module';
import { ExerciseSet, WorkoutEntry } from '../../db/entities';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsRepository } from './workouts.repository';
import { WorkoutsService } from './workouts.service';

@Module({
  imports: [
    ExercisesModule,
    TypeOrmModule.forFeature([WorkoutEntry, ExerciseSet]),
  ],
  controllers: [WorkoutsController],
  providers: [WorkoutsRepository, WorkoutsService],
})
export class WorkoutsModule {}
