import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

declare module 'ioredis' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by ioredis's declaration-merging arity for custom commands
  interface RedisCommander<Context> {
    reserveCapacity(
      key: string,
      requested: number,
      cap: number,
    ): Promise<number>;
  }
}

// Atomically checks the running total against `cap` before incrementing it,
// so concurrent Vendors can't collectively over-queue a batch's pre-bookable capacity.
const RESERVE_CAPACITY_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local requested = tonumber(ARGV[1])
local cap = tonumber(ARGV[2])
if current + requested > cap then
  return 0
end
redis.call('INCRBYFLOAT', KEYS[1], requested)
return 1
`;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL as string, {
      lazyConnect: true,
    });
    this.client.defineCommand('reserveCapacity', {
      numberOfKeys: 1,
      lua: RESERVE_CAPACITY_SCRIPT,
    });
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  private queuedKey(batchId: string): string {
    return `prebooking:queued:${batchId}`;
  }

  private holdKey(preBookingId: string): string {
    return `prebooking:hold:${preBookingId}`;
  }

  async reserveQueueCapacity(
    batchId: string,
    quantity: number,
    cap: number,
  ): Promise<boolean> {
    const reserved = await this.client.reserveCapacity(
      this.queuedKey(batchId),
      quantity,
      cap,
    );
    return reserved === 1;
  }

  async releaseQueueCapacity(batchId: string, quantity: number) {
    await this.client.incrbyfloat(this.queuedKey(batchId), -quantity);
  }

  async setPaymentHold(preBookingId: string, ttlSeconds: number) {
    await this.client.set(this.holdKey(preBookingId), '1', 'EX', ttlSeconds);
  }

  async clearPaymentHold(preBookingId: string) {
    await this.client.del(this.holdKey(preBookingId));
  }
}
