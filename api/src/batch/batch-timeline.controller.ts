import { Controller, Get, Param } from '@nestjs/common';
import { BatchesService } from './batches.service';

@Controller('batches')
export class BatchTimelineController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.batchesService.getTimeline(id);
  }
}
