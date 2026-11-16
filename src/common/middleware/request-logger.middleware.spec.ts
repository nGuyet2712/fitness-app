import { jest } from '@jest/globals';
import { HttpStatus, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { EventEmitter } from 'node:events';
import { requestLogger } from './request-logger.middleware';

function runRequest(statusCode: number, originalUrl = '/workouts'): jest.Mock {
  const req = { method: 'GET', originalUrl } as Request;
  const res = Object.assign(new EventEmitter(), { statusCode });
  const next = jest.fn();

  requestLogger(req, res as Response, next as NextFunction);
  res.emit('finish');

  return next;
}

describe('requestLogger', () => {
  let logSpy: jest.SpiedFunction<Logger['log']>;
  let warnSpy: jest.SpiedFunction<Logger['warn']>;
  let errorSpy: jest.SpiedFunction<Logger['error']>;

  beforeEach(() => {
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call next when a request arrives', async () => {
    const next = runRequest(HttpStatus.OK);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should log at log level with method, path, status and duration when the status is 2xx', async () => {
    runRequest(HttpStatus.CREATED);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/workouts 201 \d+\.\dms$/),
    );
  });

  it('should log at warn level when the status is 4xx', async () => {
    runRequest(HttpStatus.NOT_FOUND);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(' 404 '));
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should log at error level when the status is 5xx', async () => {
    runRequest(HttpStatus.INTERNAL_SERVER_ERROR);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(' 500 '));
  });

  it('should strip the query string when the URL has one', async () => {
    runRequest(HttpStatus.OK, '/workouts?userId=u-1&cursor=abc');

    const line = logSpy.mock.calls[0][0] as string;
    expect(line).toMatch(/^GET \/workouts 200 /);
    expect(line).not.toContain('userId');
  });
});
