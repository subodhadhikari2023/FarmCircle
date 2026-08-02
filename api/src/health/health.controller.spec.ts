import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health-indicator';
import { MongoHealthIndicator } from './indicators/mongo.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealthCheckService = {
    check: jest.fn(),
  };
  const mockPrismaHealth = { isHealthy: jest.fn() };
  const mockMongoHealth = { isHealthy: jest.fn() };
  const mockRedisHealth = { isHealthy: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: PrismaHealthIndicator, useValue: mockPrismaHealth },
        { provide: MongoHealthIndicator, useValue: mockMongoHealth },
        { provide: RedisHealthIndicator, useValue: mockRedisHealth },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('checks postgres, mongo, and redis, and returns the aggregated result', async () => {
    const aggregated = { status: 'ok', info: {}, error: {}, details: {} };
    mockHealthCheckService.check.mockImplementation(
      async (indicators: Array<() => unknown>) => {
        await Promise.all(indicators.map((fn) => fn()));
        return aggregated;
      },
    );
    mockPrismaHealth.isHealthy.mockResolvedValue({
      postgres: { status: 'up' },
    });
    mockMongoHealth.isHealthy.mockResolvedValue({ mongo: { status: 'up' } });
    mockRedisHealth.isHealthy.mockResolvedValue({ redis: { status: 'up' } });

    const result = await controller.check();

    expect(mockPrismaHealth.isHealthy).toHaveBeenCalledWith('postgres');
    expect(mockMongoHealth.isHealthy).toHaveBeenCalledWith('mongo');
    expect(mockRedisHealth.isHealthy).toHaveBeenCalledWith('redis');
    expect(result).toEqual(aggregated);
  });
});
