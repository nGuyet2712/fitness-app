import { LoggerService } from '@nestjs/common';
import { WinstonLogger } from 'nest-winston/dist/winston.classes.js';
import { utilities } from 'nest-winston/dist/winston.utilities.js';
import { LoggerOptions, createLogger, format, transports } from 'winston';
import appConfig from '@/config/app.config';

export interface AppLoggerSettings {
  nodeEnv: string;
  logLevel: string;
}

export function buildLoggerOptions({
  nodeEnv,
  logLevel,
}: AppLoggerSettings): LoggerOptions {
  const consoleFormat =
    nodeEnv === 'production'
      ? format.combine(format.timestamp(), format.json())
      : format.combine(
          format.timestamp(),
          utilities.format.nestLike('Everfit', {
            colors: true,
            prettyPrint: true,
          }),
        );

  return {
    level: logLevel,
    defaultMeta: { env: nodeEnv },
    transports: [new transports.Console({ format: consoleFormat })],
  };
}

export function createAppLogger(): LoggerService {
  return new WinstonLogger(createLogger(buildLoggerOptions(appConfig())));
}
