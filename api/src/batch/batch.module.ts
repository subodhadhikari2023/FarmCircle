import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BatchesController } from './batches.controller';
import { BatchTimelineController } from './batch-timeline.controller';
import { BatchesService } from './batches.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import {
  BatchActivityLog,
  BatchActivityLogSchema,
} from './schemas/batch-activity-log.schema';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MongooseModule.forFeature([
      { name: BatchActivityLog.name, schema: BatchActivityLogSchema },
    ]),
  ],
  controllers: [BatchesController, BatchTimelineController],
  providers: [BatchesService],
})
export class BatchModule {}
