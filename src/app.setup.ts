import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestLogger } from './common/middleware/request-logger.middleware';

export interface AppSetupOptions {
  /** Express body-parser JSON limit, e.g. '50kb'. */
  requestBodyLimit?: string;
}

/**
 * Global middleware, pipes and filters, applied by main.ts.
 */
export function configureApp(
  app: INestApplication,
  options: AppSetupOptions = {},
): void {
  const { requestBodyLimit } = options;

  if (requestBodyLimit) {
    (app as NestExpressApplication).useBodyParser('json', {
      limit: requestBodyLimit,
    });
  }

  app.use(requestLogger);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}
