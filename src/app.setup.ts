import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestLogger } from './common/middleware/request-logger.middleware';

/**
 * Global middleware, pipes and filters, applied by main.ts.
 */
export function configureApp(app: INestApplication): void {
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
