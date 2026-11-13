import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { databaseConfig, typeOrmConfig } from './database.config';

config();

const AppDataSource = new DataSource(typeOrmConfig(databaseConfig()));

export default AppDataSource;
