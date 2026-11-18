import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalRecordsModule } from './components/personal-records/personal-records.module';
import { WorkoutsModule } from './components/workouts/workouts.module';
import appConfig from './config/app.config';
import { databaseConfig, typeOrmConfigAsync } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
    }),
    TypeOrmModule.forRootAsync(typeOrmConfigAsync),
    WorkoutsModule,
    PersonalRecordsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
