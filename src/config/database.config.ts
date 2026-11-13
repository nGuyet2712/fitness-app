import { ConfigType, registerAs } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { allEntities } from '@/db/entities';
import { allMigrations } from '@/db/migrations';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '', 10) || 5432,
  username: process.env.DB_USERNAME || 'everfit',
  password: process.env.DB_PASSWORD || 'everfit_password',
  database: process.env.DB_NAME || 'everfit',
  // Logs every SQL query to the console (TypeORM's logger, not Winston).
  logging: process.env.DB_LOGGING === 'true',
}));

export function typeOrmConfig(
  db: ConfigType<typeof databaseConfig>,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
    entities: allEntities,
    migrations: allMigrations,
    synchronize: false,
    logging: db.logging,
  };
}

export const typeOrmConfigAsync: TypeOrmModuleAsyncOptions = {
  inject: [databaseConfig.KEY],
  useFactory: (db: ConfigType<typeof databaseConfig>) => typeOrmConfig(db),
};
