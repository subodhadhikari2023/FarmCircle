import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaHealthIndicator } from './indicators/prisma.health-indicator';
import { MongoHealthIndicator } from './indicators/mongo.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';

// Skips the global rate limit — a deployment platform's liveness/readiness
// probe polls this on its own schedule, independent of real client traffic,
// and shouldn't ever be able to trip the same guard as normal requests.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly mongoHealth: MongoHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('postgres'),
      () => this.mongoHealth.isHealthy('mongo'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }
}
