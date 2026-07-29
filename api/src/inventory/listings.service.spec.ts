import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from 'generated/prisma/enums';

describe('ListingsService', () => {
  let service: ListingsService;

  const mockPrismaService = {
    crop: {
      findFirst: jest.fn(),
    },
    variety: {
      findFirst: jest.fn(),
    },
    listing: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    batch: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
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

    it('creates a direct-path listing that is published immediately', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue({
        id: 'crop1',
        ownerId: 'u1',
      });
      mockPrismaService.variety.findFirst.mockResolvedValue({
        id: 'variety1',
        cropId: 'crop1',
      });
      const created = { id: 'l1', ownerId: 'u1', ...dto };
      mockPrismaService.listing.create.mockResolvedValue(created);

      const result = await service.create('u1', dto);

      expect(mockPrismaService.crop.findFirst).toHaveBeenCalledWith({
        where: { id: 'crop1', ownerId: 'u1' },
      });
      expect(mockPrismaService.variety.findFirst).toHaveBeenCalledWith({
        where: { id: 'variety1', cropId: 'crop1' },
      });
      expect(mockPrismaService.listing.create).toHaveBeenCalledWith({
        data: {
          ownerId: 'u1',
          cropId: 'crop1',
          varietyId: 'variety1',
          batchId: null,
          hasTrackedCycle: false,
          retailPrice: 50,
          wholesalePrice: 35,
          minWholesaleQty: 15,
          retailCeilingPercent: 10,
          preBookablePercent: 60,
          availableQuantity: 100,
          isPublished: true,
        },
      });
      expect(result).toEqual(created);
    });

    it('throws NotFoundException when the crop does not exist or is not owned by the user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue(null);

      await expect(service.create('u1', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.listing.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the variety does not belong to the crop', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue({
        id: 'crop1',
        ownerId: 'u1',
      });
      mockPrismaService.variety.findFirst.mockResolvedValue(null);

      await expect(service.create('u1', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.listing.create).not.toHaveBeenCalled();
    });
  });

  describe('findPublished', () => {
    const listing = {
      id: 'l1',
      ownerId: 'u1',
      retailPrice: 50,
      wholesalePrice: 35,
      minWholesaleQty: 15,
      isPublished: true,
      isClosed: false,
    };

    it('lists published, open listings', async () => {
      mockPrismaService.listing.findMany.mockResolvedValue([listing]);

      await service.findPublished(Role.VENDOR);

      expect(mockPrismaService.listing.findMany).toHaveBeenCalledWith({
        where: { isPublished: true, isClosed: false },
      });
    });

    it('includes wholesale pricing for an authenticated Vendor', async () => {
      mockPrismaService.listing.findMany.mockResolvedValue([listing]);

      const result = await service.findPublished(Role.VENDOR);

      expect(result[0]).toEqual(listing);
    });

    it('strips wholesale pricing for anyone who is not a Vendor', async () => {
      mockPrismaService.listing.findMany.mockResolvedValue([listing]);

      const result = await service.findPublished(undefined);

      expect(result[0]).not.toHaveProperty('wholesalePrice');
      expect(result[0]).not.toHaveProperty('minWholesaleQty');
      expect(result[0]).toMatchObject({ id: 'l1', retailPrice: 50 });
    });

    it('strips wholesale pricing for an authenticated Customer', async () => {
      mockPrismaService.listing.findMany.mockResolvedValue([listing]);

      const result = await service.findPublished(Role.CUSTOMER);

      expect(result[0]).not.toHaveProperty('wholesalePrice');
    });
  });

  describe('findOnePublic', () => {
    const listing = {
      id: 'l1',
      ownerId: 'u1',
      retailPrice: 50,
      wholesalePrice: 35,
      minWholesaleQty: 15,
      isPublished: true,
    };

    it('returns the listing with wholesale pricing for a Vendor', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(listing);

      const result = await service.findOnePublic('l1', Role.VENDOR);

      expect(mockPrismaService.listing.findFirst).toHaveBeenCalledWith({
        where: { id: 'l1', isPublished: true },
      });
      expect(result).toEqual(listing);
    });

    it('strips wholesale pricing for an unauthenticated request', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(listing);

      const result = await service.findOnePublic('l1', undefined);

      expect(result).not.toHaveProperty('wholesalePrice');
      expect(result).not.toHaveProperty('minWholesaleQty');
    });

    it('throws NotFoundException when the listing does not exist or is unpublished', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(null);

      await expect(service.findOnePublic('l1', Role.VENDOR)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUpcoming', () => {
    it('returns batches that have not yet had their harvest confirmed', async () => {
      const batches = [{ id: 'b1', harvestConfirmed: false }];
      mockPrismaService.batch.findMany.mockResolvedValue(batches);

      const result = await service.getUpcoming();

      expect(mockPrismaService.batch.findMany).toHaveBeenCalledWith({
        where: { harvestConfirmed: false },
        include: { crop: true, variety: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(batches);
    });
  });

  describe('update', () => {
    it("updates the listing's available quantity", async () => {
      const listing = { id: 'l1', ownerId: 'u1', availableQuantity: 100 };
      mockPrismaService.listing.findFirst.mockResolvedValue(listing);
      const updated = { ...listing, availableQuantity: 80 };
      mockPrismaService.listing.update.mockResolvedValue(updated);

      const result = await service.update('u1', 'l1', {
        availableQuantity: 80,
      });

      expect(mockPrismaService.listing.findFirst).toHaveBeenCalledWith({
        where: { id: 'l1', ownerId: 'u1' },
      });
      expect(mockPrismaService.listing.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { availableQuantity: 80 },
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when the listing does not exist or is not owned by the user', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(null);

      await expect(
        service.update('u1', 'l1', { availableQuantity: 80 }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.listing.update).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('closes an open listing', async () => {
      const listing = {
        id: 'l1',
        ownerId: 'u1',
        isClosed: false,
      };
      mockPrismaService.listing.findFirst.mockResolvedValue(listing);
      const updated = { ...listing, isClosed: true };
      mockPrismaService.listing.update.mockResolvedValue(updated);

      const result = await service.close('u1', 'l1');

      expect(mockPrismaService.listing.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { isClosed: true },
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when the listing does not exist or is not owned by the user', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(null);

      await expect(service.close('u1', 'l1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.listing.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the listing is already closed', async () => {
      const listing = { id: 'l1', ownerId: 'u1', isClosed: true };
      mockPrismaService.listing.findFirst.mockResolvedValue(listing);

      await expect(service.close('u1', 'l1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.listing.update).not.toHaveBeenCalled();
    });
  });
});
