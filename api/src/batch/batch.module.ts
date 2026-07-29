import { Module } from '@nestjs/common';
import { BatchesController } from './batches.controller';
import { BatchTimelineController } from './batch-timeline.controller';
import { BatchesService } from './batches.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BatchesController, BatchTimelineController],
  providers: [BatchesService],
})
export class BatchModule {}
