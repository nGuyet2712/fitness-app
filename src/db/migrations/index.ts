import type { MigrationInterface } from 'typeorm';
import { InitialSetup1794856507127 } from './1794856507127-InitialSetup';

export const allMigrations: (new () => MigrationInterface)[] = [
  InitialSetup1794856507127,
];
