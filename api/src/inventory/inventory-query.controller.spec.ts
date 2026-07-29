import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { InventoryQueryController } from './inventory-query.controller';
import { ListingsService } from './listings.service';

describe('InventoryQueryController', () => {
  let controller: InventoryQueryController;

  const mockListingsService = {
    findPublished: jest.fn(),
    findOnePublic: jest.fn(),
    getUpcoming: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryQueryController],
      providers: [{ provide: ListingsService, useValue: mockListingsService }],
    }).compile();

    controller = module.get<InventoryQueryController>(InventoryQueryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it("delegates to listingsService.findPublished with the requester's role when authenticated", async () => {
      const listings = [{ id: 'l1' }];
      mockListingsService.findPublished.mockResolvedValue(listings);
      const req = { user: { id: 'u1', role: 'VENDOR' } } as unknown as Request;

      const result = await controller.findAll(req);

      expect(mockListingsService.findPublished).toHaveBeenCalledWith('VENDOR');
      expect(result).toEqual(listings);
    });

    it('delegates to listingsService.findPublished with undefined when there is no authenticated user', async () => {
      const listings = [{ id: 'l1' }];
      mockListingsService.findPublished.mockResolvedValue(listings);
      const req = {} as unknown as Request;

      const result = await controller.findAll(req);

      expect(mockListingsService.findPublished).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(listings);
    });
  });

  describe('getUpcoming', () => {
    it('delegates to listingsService.getUpcoming', async () => {
      const batches = [{ id: 'b1' }];
      mockListingsService.getUpcoming.mockResolvedValue(batches);

      const result = await controller.getUpcoming();

      expect(mockListingsService.getUpcoming).toHaveBeenCalled();
      expect(result).toEqual(batches);
    });
  });

  describe('findOne', () => {
    it("delegates to listingsService.findOnePublic with the id param and the requester's role", async () => {
      const listing = { id: 'l1' };
      mockListingsService.findOnePublic.mockResolvedValue(listing);
      const req = {
        user: { id: 'u1', role: 'CUSTOMER' },
      } as unknown as Request;

      const result = await controller.findOne(req, 'l1');

      expect(mockListingsService.findOnePublic).toHaveBeenCalledWith(
        'l1',
        'CUSTOMER',
      );
      expect(result).toEqual(listing);
    });

    it('delegates with undefined role when there is no authenticated user', async () => {
      const listing = { id: 'l1' };
      mockListingsService.findOnePublic.mockResolvedValue(listing);
      const req = {} as unknown as Request;

      const result = await controller.findOne(req, 'l1');

      expect(mockListingsService.findOnePublic).toHaveBeenCalledWith(
        'l1',
        undefined,
      );
      expect(result).toEqual(listing);
    });
  });
});
