import { Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { createAppLogger } from './common/logger/app-logger';
import appConfig from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: createAppLogger(),
  });

  const { port, requestBodyLimit } = app.get<ConfigType<typeof appConfig>>(
    appConfig.KEY,
  );

  configureApp(app, { requestBodyLimit });

  await app.listen(port);
  new Logger('Bootstrap').log(`Listening on port ${port}`);
}
void bootstrap();
