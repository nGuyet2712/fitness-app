import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';
import dataSource from './data-source.config';

const options: DataSourceOptions & SeederOptions = {
  ...dataSource.options,
  seeds: ['src/db/seeds/*-*.ts'],
  seedTracking: false,
};

export default new DataSource(options);
