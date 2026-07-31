import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { ListingsService } from './listings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListingContent } from './schemas/listing-content.schema';
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
      findFirst: jest.fn(),
    },
  };

  const mockContentModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };

  const noContent = {
    description: undefined,
    images: [],
    isOrganicCertified: false,
    attributes: undefined,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockContentModel.create.mockResolvedValue(null);
    mockContentModel.find.mockResolvedValue([]);
    mockContentModel.findOne.mockResolvedValue(null);
    mockContentModel.findOneAndUpdate.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: getModelToken(ListingContent.name),
          useValue: mockContentModel,
        },
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

    it('creates a direct-path listing that is published immediately, with an empty Mongo content doc', async () => {
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
      mockContentModel.create.mockResolvedValue({
        listingId: 'l1',
        ...noContent,
      });

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
      expect(mockContentModel.create).toHaveBeenCalledWith({
        listingId: 'l1',
        description: undefined,
        images: [],
        isOrganicCertified: false,
        attributes: undefined,
      });
      expect(result).toEqual({ ...created, ...noContent });
    });

    it('persists description/images/isOrganicCertified/attributes to Mongo when provided', async () => {
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
      const contentDto = {
        description: 'Fresh organic tomatoes',
        images: ['https://example.com/a.jpg'],
        isOrganicCertified: true,
        attributes: { color: 'red' },
      };
      mockContentModel.create.mockResolvedValue({
        listingId: 'l1',
        ...contentDto,
      });

      const result = await service.create('u1', { ...dto, ...contentDto });

      expect(mockContentModel.create).toHaveBeenCalledWith({
        listingId: 'l1',
        ...contentDto,
      });
      expect(result).toEqual({ ...created, ...contentDto });
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
        include: {
          crop: { select: { name: true } },
          variety: { select: { name: true } },
        },
      });
      expect(mockContentModel.find).toHaveBeenCalledWith({
        listingId: { $in: ['l1'] },
      });
    });

    it('includes wholesale pricing for an authenticated Vendor, merged with Mongo content', async () => {
      mockPrismaService.listing.findMany.mockResolvedValue([listing]);
      mockContentModel.find.mockResolvedValue([
        {
          listingId: 'l1',
          description: 'Ripe',
          images: [],
          isOrganicCertified: true,
          attributes: undefined,
        },
      ]);

      const result = await service.findPublished(Role.VENDOR);

      expect(result[0]).toEqual({
        ...listing,
        description: 'Ripe',
        images: [],
        isOrganicCertified: true,
        attributes: undefined,
      });
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

    it('returns the listing merged with its Mongo content, with wholesale pricing for a Vendor', async () => {
      mockPrismaService.listing.findFirst.mockResolvedValue(listing);

      const result = await service.findOnePublic('l1', Role.VENDOR);

      expect(mockPrismaService.listing.findFirst).toHaveBeenCalledWith({
        where: { id: 'l1', isPublished: true },
        include: {
          crop: { select: { name: true } },
          variety: { select: { name: true } },
        },
      });
      expect(mockContentModel.findOne).toHaveBeenCalledWith({
        listingId: 'l1',
      });
      expect(result).toEqual({ ...listing, ...noContent });
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
      expect(mockContentModel.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getUpcoming', () => {
    it('returns unpublished tracked draft listings, merged with Mongo content', async () => {
      const listing = {
        id: 'l1',
        hasTrackedCycle: true,
        isPublished: false,
        isClosed: false,
      };
      mockPrismaService.listing.findMany.mockResolvedValue([listing]);
      mockContentModel.find.mockResolvedValue([
        { listingId: 'l1', description: 'Growing well', images: [] },
      ]);

      const result = await service.getUpcoming();

      expect(mockPrismaService.listing.findMany).toHaveBeenCalledWith({
        where: { hasTrackedCycle: true, isPublished: false, isClosed: false },
        orderBy: { createdAt: 'asc' },
      });
      expect(mockContentModel.find).toHaveBeenCalledWith({
        listingId: { $in: ['l1'] },
      });
      expect(result).toEqual([
        {
          ...listing,
          description: 'Growing well',
          images: [],
          isOrganicCertified: false,
          attributes: undefined,
        },
      ]);
    });
  });

  describe('update', () => {
    it("updates the listing's available quantity, leaving Mongo content untouched when no content fields are given", async () => {
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
      expect(mockContentModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(mockContentModel.findOne).toHaveBeenCalledWith({
        listingId: 'l1',
      });
      expect(result).toEqual({ ...updated, ...noContent });
    });

    it('upserts content fields to Mongo when provided', async () => {
      const listing = { id: 'l1', ownerId: 'u1', availableQuantity: 100 };
      mockPrismaService.listing.findFirst.mockResolvedValue(listing);
      mockPrismaService.listing.update.mockResolvedValue(listing);
      mockContentModel.findOneAndUpdate.mockResolvedValue({
        listingId: 'l1',
        description: 'Fresh organic apples',
        images: [],
        isOrganicCertified: true,
        attributes: undefined,
      });

      const result = await service.update('u1', 'l1', {
        description: 'Fresh organic apples',
        isOrganicCertified: true,
      });

      expect(mockContentModel.findOneAndUpdate).toHaveBeenCalledWith(
        { listingId: 'l1' },
        {
          $set: {
            description: 'Fresh organic apples',
            isOrganicCertified: true,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
      expect(result).toMatchObject({
        description: 'Fresh organic apples',
        isOrganicCertified: true,
      });
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

  describe('createDraftFromBatch', () => {
    const dto = {
      retailPrice: 50,
      wholesalePrice: 35,
      minWholesaleQty: 15,
      retailCeilingPercent: 10,
      preBookablePercent: 60,
    };

    const batchAtFinalMilestone = {
      id: 'b1',
      ownerId: 'u1',
      cropId: 'crop1',
      varietyId: 'variety1',
      currentMilestoneOrder: 2,
      milestoneProgress: [{ order: 1 }, { order: 2 }],
    };

    it('creates an unpublished tracked listing with an empty Mongo content doc', async () => {
      mockPrismaService.batch.findFirst.mockResolvedValue(
        batchAtFinalMilestone,
      );
      mockPrismaService.listing.findFirst.mockResolvedValue(null);
      const created = {
        id: 'l1',
        ownerId: 'u1',
        cropId: 'crop1',
        varietyId: 'variety1',
        batchId: 'b1',
        hasTrackedCycle: true,
        isPublished: false,
        ...dto,
      };
      mockPrismaService.listing.create.mockResolvedValue(created);
      mockContentModel.create.mockResolvedValue({
        listingId: 'l1',
        ...noContent,
      });

      const result = await service.createDraftFromBatch('u1', 'b1', dto);

      expect(mockPrismaService.batch.findFirst).toHaveBeenCalledWith({
        where: { id: 'b1', ownerId: 'u1' },
        include: { milestoneProgress: true },
      });
      expect(mockPrismaService.listing.findFirst).toHaveBeenCalledWith({
        where: { batchId: 'b1' },
      });
      expect(mockPrismaService.listing.create).toHaveBeenCalledWith({
        data: {
          ownerId: 'u1',
          cropId: 'crop1',
          varietyId: 'variety1',
          batchId: 'b1',
          hasTrackedCycle: true,
          retailPrice: 50,
          wholesalePrice: 35,
          minWholesaleQty: 15,
          retailCeilingPercent: 10,
          preBookablePercent: 60,
          availableQuantity: 0,
          isPublished: false,
        },
      });
      expect(mockContentModel.create).toHaveBeenCalledWith({
        listingId: 'l1',
        description: undefined,
        images: [],
        isOrganicCertified: false,
        attributes: undefined,
      });
      expect(result).toEqual({ ...created, ...noContent });
    });

    it('throws NotFoundException when the batch does not exist or is not owned by the user', async () => {
      mockPrismaService.batch.findFirst.mockResolvedValue(null);

      await expect(
        service.createDraftFromBatch('u1', 'b1', dto),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.listing.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the batch has not reached its final milestone yet', async () => {
      mockPrismaService.batch.findFirst.mockResolvedValue({
        ...batchAtFinalMilestone,
        currentMilestoneOrder: 1,
      });

      await expect(
        service.createDraftFromBatch('u1', 'b1', dto),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.listing.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a listing already exists for this batch', async () => {
      mockPrismaService.batch.findFirst.mockResolvedValue(
        batchAtFinalMilestone,
      );
      mockPrismaService.listing.findFirst.mockResolvedValue({ id: 'l0' });

      await expect(
        service.createDraftFromBatch('u1', 'b1', dto),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.listing.create).not.toHaveBeenCalled();
    });
  });
});
