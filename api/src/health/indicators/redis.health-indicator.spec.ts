import { Test, TestingModule } from '@nestjs/testing';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health-indicator';
import { RedisService } from '../../redis/redis.service';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;

  const mockRedisService = {
    client: { ping: jest.fn() },
  };

  const mockSession = {
    up: jest.fn(),
    down: jest.fn(),
  };

  const mockHealthIndicatorService = {
    check: jest.fn().mockReturnValue(mockSession),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockHealthIndicatorService.check.mockReturnValue(mockSession);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        { provide: RedisService, useValue: mockRedisService },
        {
          provide: HealthIndicatorService,
          useValue: mockHealthIndicatorService,
        },
      ],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
  });

  it('reports up when redis responds to ping', async () => {
    mockRedisService.client.ping.mockResolvedValue('PONG');
    mockSession.up.mockReturnValue({ redis: { status: 'up' } });

    const result = await indicator.isHealthy('redis');

    expect(mockHealthIndicatorService.check).toHaveBeenCalledWith('redis');
    expect(mockSession.up).toHaveBeenCalled();
    expect(result).toEqual({ redis: { status: 'up' } });
  });

  it('reports down with the error message when ping fails', async () => {
    mockRedisService.client.ping.mockRejectedValue(new Error('ECONNREFUSED'));
    mockSession.down.mockReturnValue({
      redis: { status: 'down', message: 'ECONNREFUSED' },
    });

    const result = await indicator.isHealthy('redis');

    expect(mockSession.down).toHaveBeenCalledWith('ECONNREFUSED');
    expect(result).toEqual({
      redis: { status: 'down', message: 'ECONNREFUSED' },
    });
  });
});
