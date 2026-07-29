import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';

describe('BatchesController', () => {
  let controller: BatchesController;

  const mockBatchesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    advanceMilestone: jest.fn(),
    confirmHarvest: jest.fn(),
  };

  const mockRequest = {
    user: { id: 'u1', role: 'GROWER' },
  } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BatchesController],
      providers: [{ provide: BatchesService, useValue: mockBatchesService }],
    }).compile();

    controller = module.get<BatchesController>(BatchesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it("delegates to batchesService.create with the authenticated user's id and dto", async () => {
      const dto = {
        cropId: 'crop1',
        varietyId: 'variety1',
        cycleId: 'cy1',
        quantity: 100,
        predictedYield: 80,
      };
      const batch = { id: 'b1', ownerId: 'u1', ...dto };
      mockBatchesService.create.mockResolvedValue(batch);

      const result = await controller.create(mockRequest, dto);

      expect(mockBatchesService.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(batch);
    });
  });

  describe('findAll', () => {
    it("delegates to batchesService.findAll with the authenticated user's id", async () => {
      const batches = [{ id: 'b1', ownerId: 'u1' }];
      mockBatchesService.findAll.mockResolvedValue(batches);

      const result = await controller.findAll(mockRequest);

      expect(mockBatchesService.findAll).toHaveBeenCalledWith('u1');
      expect(result).toEqual(batches);
    });
  });

  describe('findOne', () => {
    it("delegates to batchesService.findOne with the authenticated user's id and the id param", async () => {
      const batch = { id: 'b1', ownerId: 'u1' };
      mockBatchesService.findOne.mockResolvedValue(batch);

      const result = await controller.findOne(mockRequest, 'b1');

      expect(mockBatchesService.findOne).toHaveBeenCalledWith('u1', 'b1');
      expect(result).toEqual(batch);
    });
  });

  describe('advanceMilestone', () => {
    it("delegates to batchesService.advanceMilestone with the authenticated user's id, id param, and dto", async () => {
      const dto = { reachedAt: '2026-01-05' };
      const batch = { id: 'b1', ownerId: 'u1', currentMilestoneOrder: 1 };
      mockBatchesService.advanceMilestone.mockResolvedValue(batch);

      const result = await controller.advanceMilestone(mockRequest, 'b1', dto);

      expect(mockBatchesService.advanceMilestone).toHaveBeenCalledWith(
        'u1',
        'b1',
        dto,
      );
      expect(result).toEqual(batch);
    });
  });

  describe('confirmHarvest', () => {
    it("delegates to batchesService.confirmHarvest with the authenticated user's id, id param, and dto", async () => {
      const dto = { actualYield: 75 };
      const batch = {
        id: 'b1',
        ownerId: 'u1',
        actualYield: 75,
        harvestConfirmed: true,
      };
      mockBatchesService.confirmHarvest.mockResolvedValue(batch);

      const result = await controller.confirmHarvest(mockRequest, 'b1', dto);

      expect(mockBatchesService.confirmHarvest).toHaveBeenCalledWith(
        'u1',
        'b1',
        dto,
      );
      expect(result).toEqual(batch);
    });
  });
});
