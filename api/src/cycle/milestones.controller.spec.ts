import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';

describe('MilestonesController', () => {
  let controller: MilestonesController;

  const mockMilestonesService = {
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockRequest = {
    user: { id: 'u1', role: 'GROWER' },
  } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MilestonesController],
      providers: [
        { provide: MilestonesService, useValue: mockMilestonesService },
      ],
    }).compile();

    controller = module.get<MilestonesController>(MilestonesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('update', () => {
    it("delegates to milestonesService.update with the authenticated user's id, the id param, and dto", async () => {
      const dto = { expectedDurationDays: 7 };
      const milestone = { id: 'm1', cycleId: 'cy1', ...dto };
      mockMilestonesService.update.mockResolvedValue(milestone);

      const result = await controller.update(mockRequest, 'm1', dto);

      expect(mockMilestonesService.update).toHaveBeenCalledWith(
        'u1',
        'm1',
        dto,
      );
      expect(result).toEqual(milestone);
    });
  });

  describe('remove', () => {
    it("delegates to milestonesService.remove with the authenticated user's id and the id param", async () => {
      mockMilestonesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(mockRequest, 'm1');

      expect(mockMilestonesService.remove).toHaveBeenCalledWith('u1', 'm1');
      expect(result).toBeUndefined();
    });
  });
});
