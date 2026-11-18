import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercise } from '@/db/entities';
import { ExercisesRepository } from './exercises.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Exercise])],
  providers: [ExercisesRepository],
  exports: [ExercisesRepository],
})
export class ExercisesModule {}
