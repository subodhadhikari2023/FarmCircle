import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { HealthIndicatorService } from '@nestjs/terminus';
import { MongoHealthIndicator } from './mongo.health-indicator';

describe('MongoHealthIndicator', () => {
  const mockPing = jest.fn();
  const mockConnection = {
    db: { admin: () => ({ ping: mockPing }) },
  };

  const mockSession = {
    up: jest.fn(),
    down: jest.fn(),
  };

  const mockHealthIndicatorService = {
    check: jest.fn().mockReturnValue(mockSession),
  };

  async function buildIndicator(connection: unknown) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MongoHealthIndicator,
        { provide: getConnectionToken(), useValue: connection },
        {
          provide: HealthIndicatorService,
          useValue: mockHealthIndicatorService,
        },
      ],
    }).compile();

    return module.get<MongoHealthIndicator>(MongoHealthIndicator);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockHealthIndicatorService.check.mockReturnValue(mockSession);
  });

  it('reports up when mongo responds to ping', async () => {
    mockPing.mockResolvedValue({ ok: 1 });
    mockSession.up.mockReturnValue({ mongo: { status: 'up' } });
    const indicator = await buildIndicator(mockConnection);

    const result = await indicator.isHealthy('mongo');

    expect(mockHealthIndicatorService.check).toHaveBeenCalledWith('mongo');
    expect(mockSession.up).toHaveBeenCalled();
    expect(result).toEqual({ mongo: { status: 'up' } });
  });

  it('reports down with the error message when ping fails', async () => {
    mockPing.mockRejectedValue(new Error('topology closed'));
    mockSession.down.mockReturnValue({
      mongo: { status: 'down', message: 'topology closed' },
    });
    const indicator = await buildIndicator(mockConnection);

    const result = await indicator.isHealthy('mongo');

    expect(mockSession.down).toHaveBeenCalledWith('topology closed');
    expect(result).toEqual({
      mongo: { status: 'down', message: 'topology closed' },
    });
  });

  it('reports down without pinging when the db connection is not established', async () => {
    mockSession.down.mockReturnValue({
      mongo: { status: 'down', message: 'Mongo connection not established' },
    });
    const indicator = await buildIndicator({ db: undefined });

    const result = await indicator.isHealthy('mongo');

    expect(mockPing).not.toHaveBeenCalled();
    expect(mockSession.down).toHaveBeenCalledWith(
      'Mongo connection not established',
    );
    expect(result).toEqual({
      mongo: { status: 'down', message: 'Mongo connection not established' },
    });
  });
});
