import { Test, TestingModule } from '@nestjs/testing';
import { BatchTimelineController } from './batch-timeline.controller';
import { BatchesService } from './batches.service';

describe('BatchTimelineController', () => {
  let controller: BatchTimelineController;

  const mockBatchesService = {
    getTimeline: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BatchTimelineController],
      providers: [{ provide: BatchesService, useValue: mockBatchesService }],
    }).compile();

    controller = module.get<BatchTimelineController>(BatchTimelineController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTimeline', () => {
    it('delegates to batchesService.getTimeline with the id param', async () => {
      const batch = { id: 'b1', milestoneProgress: [] };
      mockBatchesService.getTimeline.mockResolvedValue(batch);

      const result = await controller.getTimeline('b1');

      expect(mockBatchesService.getTimeline).toHaveBeenCalledWith('b1');
      expect(result).toEqual(batch);
    });
  });
});
