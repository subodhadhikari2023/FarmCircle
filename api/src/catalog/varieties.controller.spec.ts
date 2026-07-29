import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { VarietiesController } from './varieties.controller';
import { VarietiesService } from './varieties.service';

describe('VarietiesController', () => {
  let controller: VarietiesController;

  const mockVarietiesService = {
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockRequest = {
    user: { id: 'u1', role: 'GROWER' },
  } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VarietiesController],
      providers: [
        { provide: VarietiesService, useValue: mockVarietiesService },
      ],
    }).compile();

    controller = module.get<VarietiesController>(VarietiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('update', () => {
    it("delegates to varietiesService.update with the authenticated user's id, the id param, and dto", async () => {
      const dto = { name: 'Roma' };
      const variety = { id: 'v1', cropId: 'c1', name: 'Roma' };
      mockVarietiesService.update.mockResolvedValue(variety);

      const result = await controller.update(mockRequest, 'v1', dto);

      expect(mockVarietiesService.update).toHaveBeenCalledWith('u1', 'v1', dto);
      expect(result).toEqual(variety);
    });
  });

  describe('remove', () => {
    it("delegates to varietiesService.remove with the authenticated user's id and the id param", async () => {
      mockVarietiesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(mockRequest, 'v1');

      expect(mockVarietiesService.remove).toHaveBeenCalledWith('u1', 'v1');
      expect(result).toBeUndefined();
    });
  });
});
