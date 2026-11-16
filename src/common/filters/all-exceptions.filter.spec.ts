import { jest } from '@jest/globals';
import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AllExceptionsFilter,
  ErrorResponseBody,
} from './all-exceptions.filter';

interface MockResponse {
  headersSent: boolean;
  status: jest.Mock<(code: number) => MockResponse>;
  json: jest.Mock<(body: ErrorResponseBody) => MockResponse>;
}

function createHost(): { host: ArgumentsHost; response: MockResponse } {
  const response: MockResponse = {
    headersSent: false,
    status: jest.fn<(code: number) => MockResponse>(),
    json: jest.fn<(body: ErrorResponseBody) => MockResponse>(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  const request = { method: 'POST', originalUrl: '/workouts?cursor=abc' };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

function sentBody(response: MockResponse): ErrorResponseBody {
  return response.json.mock.calls[0][0];
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let errorSpy: jest.SpiedFunction<Logger['error']>;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('catch', () => {
    it('should wrap the message in an array when the HttpException message is a string', async () => {
      const { host, response } = createHost();

      filter.catch(new NotFoundException('Exercise not found'), host);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(sentBody(response)).toMatchObject({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: ['Exercise not found'],
      });
    });

    it('should keep the message array when the error comes from validation', async () => {
      const { host, response } = createHost();
      const messages = [
        'sets.0.reps must be a positive number',
        'property foo should not exist',
      ];

      filter.catch(new BadRequestException(messages), host);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(sentBody(response)).toMatchObject({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: messages,
      });
    });

    it('should use the status text as message when the HttpException has no message', async () => {
      const { host, response } = createHost();

      filter.catch(new HttpException({}, HttpStatus.CONFLICT), host);

      expect(sentBody(response)).toMatchObject({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: ['Conflict'],
      });
    });

    it('should return 500 with a generic message and log the stack when the error is unknown', async () => {
      const { host, response } = createHost();
      const error = new Error('connection to db-internal:5432 refused');

      filter.catch(error, host);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(sentBody(response)).toMatchObject({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: ['Internal server error'],
      });
      expect(errorSpy).toHaveBeenCalledWith(
        'POST /workouts failed',
        error.stack,
      );
    });

    it('should not leak the error message when an unknown error is thrown', async () => {
      const { host, response } = createHost();

      filter.catch(new Error('secret internals'), host);

      expect(JSON.stringify(sentBody(response))).not.toContain(
        'secret internals',
      );
    });

    it('should use the error status when a non-Nest error carries a 4xx status with expose', async () => {
      const { host, response } = createHost();
      const parseError = Object.assign(
        new SyntaxError('Unexpected token } in JSON'),
        {
          status: HttpStatus.BAD_REQUEST,
          expose: true,
        },
      );

      filter.catch(parseError, host);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(sentBody(response).message).toEqual([
        'Unexpected token } in JSON',
      ]);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should hide the message when a non-Nest 4xx error is not exposed', async () => {
      const { host, response } = createHost();
      const error = Object.assign(new Error('internal detail'), {
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        expose: false,
      });

      filter.catch(error, host);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
      expect(sentBody(response).message).toEqual(['Payload Too Large']);
    });

    it('should include an ISO timestamp when any error is handled', async () => {
      const { host, response } = createHost();

      filter.catch(new NotFoundException(), host);

      const { timestamp } = sentBody(response);
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should not write a response when headers were already sent', async () => {
      const { host, response } = createHost();
      response.headersSent = true;

      filter.catch(new Error('late failure'), host);

      expect(response.status).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
