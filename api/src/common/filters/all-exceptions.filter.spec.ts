import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/orders/o1',
        }),
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the HttpException status and message, and does not log', () => {
    const exception = new BadRequestException('Invalid quantity');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Invalid quantity',
      path: '/orders/o1',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() is typed `any` in @types/jest; no cast survives the no-unnecessary-type-assertion autofix
      timestamp: expect.any(String),
    });
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('preserves a class-validator style string[] message', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['quantity must be a positive number'],
      error: 'Bad Request',
    });

    filter.catch(exception, mockHost);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        message: ['quantity must be a positive number'],
      }),
    );
  });

  it('maps a non-HttpException to a 500 with a generic message, and logs it', () => {
    const exception = new Error('unexpected failure');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'GET /orders/o1 -> 500',
      exception.stack,
    );
  });

  it('logs a thrown non-Error value as a string', () => {
    filter.catch('a raw thrown string', mockHost);

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'GET /orders/o1 -> 500',
      'a raw thrown string',
    );
  });
});
