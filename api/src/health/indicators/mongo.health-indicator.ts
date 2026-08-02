import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { HealthIndicatorService } from '@nestjs/terminus';
import { Connection } from 'mongoose';

@Injectable()
export class MongoHealthIndicator {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    try {
      if (!this.connection.db) {
        throw new Error('Mongo connection not established');
      }
      await this.connection.db.admin().ping();
      return indicator.up();
    } catch (err) {
      return indicator.down((err as Error).message);
    }
  }
}
