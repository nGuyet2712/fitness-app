import 'dotenv/config';
import { DataSource } from 'typeorm';
import {
  databaseConfig,
  typeOrmConfig,
} from '../../src/config/database.config';

// The test's own connection to the app's database (`DB_*` from `.env`), used to
// seed data before a request and check rows after it. One per test file.
let dataSource: DataSource | undefined;

export async function connectTestDb(): Promise<DataSource> {
  if (dataSource?.isInitialized) return dataSource;
  dataSource = new DataSource({
    ...typeOrmConfig(databaseConfig()),
    logging: false,
  });
  await dataSource.initialize();
  return dataSource;
}

export function getTestDataSource(): DataSource {
  if (!dataSource?.isInitialized) {
    throw new Error('Call connectTestDb() in beforeAll first');
  }
  return dataSource;
}

export async function disconnectTestDb(): Promise<void> {
  if (dataSource?.isInitialized) await dataSource.destroy();
  dataSource = undefined;
}

export async function cleanAllTables(): Promise<void> {
  const ds = getTestDataSource();
  const tables = new Set(
    ds.entityMetadatas
      .filter(
        ({ tableType }) => tableType === 'regular' || tableType === 'junction',
      )
      .map(({ tableName }) => ds.driver.escape(tableName)),
  );
  if (tables.size === 0) return;
  await ds.query(`TRUNCATE ${[...tables].join(', ')} RESTART IDENTITY CASCADE`);
}
