import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { InventoryController } from './inventory.controller';
import { ListingsService } from './listings.service';

describe('InventoryController', () => {
  let controller: InventoryController;

  const mockListingsService = {
    create: jest.fn(),
    update: jest.fn(),
    close: jest.fn(),
  };

  const mockRequest = {
    user: { id: 'u1', role: 'GROWER' },
  } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: ListingsService, useValue: mockListingsService }],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it("delegates to listingsService.create with the authenticated user's id and dto", async () => {
      const dto = {
        cropId: 'crop1',
        varietyId: 'variety1',
        retailPrice: 50,
        wholesalePrice: 35,
        minWholesaleQty: 15,
        retailCeilingPercent: 10,
        preBookablePercent: 60,
        availableQuantity: 100,
      };
      const listing = { id: 'l1', ownerId: 'u1', ...dto };
      mockListingsService.create.mockResolvedValue(listing);

      const result = await controller.create(mockRequest, dto);

      expect(mockListingsService.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(listing);
    });
  });

  describe('update', () => {
    it("delegates to listingsService.update with the authenticated user's id, id param, and dto", async () => {
      const dto = { availableQuantity: 80 };
      const listing = { id: 'l1', ownerId: 'u1', ...dto };
      mockListingsService.update.mockResolvedValue(listing);

      const result = await controller.update(mockRequest, 'l1', dto);

      expect(mockListingsService.update).toHaveBeenCalledWith('u1', 'l1', dto);
      expect(result).toEqual(listing);
    });
  });

  describe('close', () => {
    it("delegates to listingsService.close with the authenticated user's id and id param", async () => {
      const listing = { id: 'l1', ownerId: 'u1', isClosed: true };
      mockListingsService.close.mockResolvedValue(listing);

      const result = await controller.close(mockRequest, 'l1');

      expect(mockListingsService.close).toHaveBeenCalledWith('u1', 'l1');
      expect(result).toEqual(listing);
    });
  });
});
