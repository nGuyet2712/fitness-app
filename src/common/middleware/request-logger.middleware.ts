import { HttpStatus, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

/** Logs one line per request: method, path (no query string), status and duration. */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const path = req.originalUrl.split('?')[0];
    const line = `${req.method} ${path} ${res.statusCode} ${durationMs.toFixed(1)}ms`;

    if (res.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      logger.error(line);
    } else if (res.statusCode >= HttpStatus.BAD_REQUEST) {
      logger.warn(line);
    } else {
      logger.log(line);
    }
  });

  next();
}
