import { Test, TestingModule } from '@nestjs/testing';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health-indicator';
import { PrismaService } from '../../prisma/prisma.service';

describe('PrismaHealthIndicator', () => {
  let indicator: PrismaHealthIndicator;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
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
        PrismaHealthIndicator,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: HealthIndicatorService,
          useValue: mockHealthIndicatorService,
        },
      ],
    }).compile();

    indicator = module.get<PrismaHealthIndicator>(PrismaHealthIndicator);
  });

  it('reports up when the database responds', async () => {
    mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockSession.up.mockReturnValue({ postgres: { status: 'up' } });

    const result = await indicator.isHealthy('postgres');

    expect(mockHealthIndicatorService.check).toHaveBeenCalledWith('postgres');
    expect(mockSession.up).toHaveBeenCalled();
    expect(result).toEqual({ postgres: { status: 'up' } });
  });

  it('reports down with the error message when the query fails', async () => {
    mockPrismaService.$queryRaw.mockRejectedValue(
      new Error('connection refused'),
    );
    mockSession.down.mockReturnValue({
      postgres: { status: 'down', message: 'connection refused' },
    });

    const result = await indicator.isHealthy('postgres');

    expect(mockSession.down).toHaveBeenCalledWith('connection refused');
    expect(result).toEqual({
      postgres: { status: 'down', message: 'connection refused' },
    });
  });
});
