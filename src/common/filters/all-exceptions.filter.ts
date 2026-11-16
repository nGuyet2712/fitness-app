import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string[];
  timestamp: string;
}

interface ResolvedError {
  statusCode: number;
  message: string[];
}

interface ClientErrorLike {
  status?: unknown;
  statusCode?: unknown;
  expose?: unknown;
  message?: unknown;
}

const statusText = (statusCode: number): string =>
  STATUS_CODES[statusCode] ?? 'Error';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { statusCode, message } = resolveError(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const path = request.originalUrl.split('?')[0];
      const trace =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${request.method} ${path} failed`, trace);
    }

    if (response.headersSent) {
      return;
    }

    const body: ErrorResponseBody = {
      statusCode,
      error: statusText(statusCode),
      message,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(body);
  }
}

function resolveError(exception: unknown): ResolvedError {
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    return {
      statusCode,
      message: messagesFrom(exception.getResponse(), statusCode),
    };
  }

  const clientError = asClientError(exception);
  if (clientError) {
    return clientError;
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    message: ['Internal server error'],
  };
}

function messagesFrom(response: string | object, statusCode: number): string[] {
  if (typeof response === 'string') {
    return [response];
  }
  const { message } = response as { message?: unknown };
  if (Array.isArray(message)) {
    return message.map(String);
  }
  if (typeof message === 'string') {
    return [message];
  }
  return [statusText(statusCode)];
}

function asClientError(exception: unknown): ResolvedError | undefined {
  if (typeof exception !== 'object' || exception === null) {
    return undefined;
  }
  const { status, statusCode, expose, message } = exception as ClientErrorLike;
  const code = typeof status === 'number' ? status : statusCode;
  if (
    typeof code !== 'number' ||
    code < HttpStatus.BAD_REQUEST ||
    code >= HttpStatus.INTERNAL_SERVER_ERROR
  ) {
    return undefined;
  }
  return {
    statusCode: code,
    message: [
      expose === true && typeof message === 'string'
        ? message
        : statusText(code),
    ],
  };
}
