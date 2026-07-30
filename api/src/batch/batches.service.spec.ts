import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { BatchesService } from './batches.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BatchActivityLog } from './schemas/batch-activity-log.schema';
import { PreBookingStatus } from 'generated/prisma/enums';

const decimal = (n: number) => ({ toNumber: () => n });

describe('BatchesService', () => {
  let service: BatchesService;

  const mockPrismaService = {
    crop: {
      findFirst: jest.fn(),
    },
    variety: {
      findFirst: jest.fn(),
    },
    cycle: {
      findFirst: jest.fn(),
    },
    batch: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    batchMilestoneProgress: {
      createMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    listing: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    preBooking: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockRedisService = {
    setPaymentHold: jest.fn(),
  };

  const mockActivityLogModel = {
    create: jest.fn(),
    find: jest.fn(),
  };

  function stubActivityLog(entries: unknown[] = []) {
    const sort = jest.fn().mockResolvedValue(entries);
    mockActivityLogModel.find.mockReturnValue({ sort });
    return sort;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    stubActivityLog();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        {
          provide: getModelToken(BatchActivityLog.name),
          useValue: mockActivityLogModel,
        },
      ],
    }).compile();

    service = module.get<BatchesService>(BatchesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = {
      cropId: 'crop1',
      varietyId: 'variety1',
      cycleId: 'cy1',
      quantity: 100,
      predictedYield: 80,
    };

    it('creates a batch and snapshots the cycle milestones as progress rows', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue({
        id: 'crop1',
        ownerId: 'u1',
      });
      mockPrismaService.variety.findFirst.mockResolvedValue({
        id: 'variety1',
        cropId: 'crop1',
      });
      mockPrismaService.cycle.findFirst.mockResolvedValue({
        id: 'cy1',
        ownerId: 'u1',
        cropId: 'crop1',
        milestones: [
          { id: 'm1', order: 1 },
          { id: 'm2', order: 2 },
        ],
      });
      const createdBatch = { id: 'b1', ownerId: 'u1', ...dto };
      mockPrismaService.batch.create.mockResolvedValue(createdBatch);
      mockPrismaService.batchMilestoneProgress.createMany.mockResolvedValue({
        count: 2,
      });
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: typeof mockPrismaService) => unknown) =>
          cb(mockPrismaService),
      );

      const result = await service.create('u1', dto);

      expect(mockPrismaService.crop.findFirst).toHaveBeenCalledWith({
        where: { id: 'crop1', ownerId: 'u1' },
      });
      expect(mockPrismaService.variety.findFirst).toHaveBeenCalledWith({
        where: { id: 'variety1', cropId: 'crop1' },
      });
      expect(mockPrismaService.cycle.findFirst).toHaveBeenCalledWith({
        where: { id: 'cy1', ownerId: 'u1', cropId: 'crop1' },
        include: { milestones: { orderBy: { order: 'asc' } } },
      });
      expect(mockPrismaService.batch.create).toHaveBeenCalledWith({
        data: {
          ownerId: 'u1',
          cropId: 'crop1',
          varietyId: 'variety1',
          cycleId: 'cy1',
          quantity: 100,
          predictedYield: 80,
        },
      });
      expect(
        mockPrismaService.batchMilestoneProgress.createMany,
      ).toHaveBeenCalledWith({
        data: [
          { batchId: 'b1', milestoneId: 'm1', order: 1 },
          { batchId: 'b1', milestoneId: 'm2', order: 2 },
        ],
      });
      expect(result).toEqual(createdBatch);
    });

    it('skips the createMany call when the cycle has no milestones', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue({
        id: 'crop1',
        ownerId: 'u1',
      });
      mockPrismaService.variety.findFirst.mockResolvedValue({
        id: 'variety1',
        cropId: 'crop1',
      });
      mockPrismaService.cycle.findFirst.mockResolvedValue({
        id: 'cy1',
        ownerId: 'u1',
        cropId: 'crop1',
        milestones: [],
      });
      const createdBatch = { id: 'b1', ownerId: 'u1', ...dto };
      mockPrismaService.batch.create.mockResolvedValue(createdBatch);
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: typeof mockPrismaService) => unknown) =>
          cb(mockPrismaService),
      );

      const result = await service.create('u1', dto);

      expect(
        mockPrismaService.batchMilestoneProgress.createMany,
      ).not.toHaveBeenCalled();
      expect(result).toEqual(createdBatch);
    });

    it('throws NotFoundException when the crop does not exist or is not owned by the user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue(null);

      await expect(service.create('u1', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.batch.create).not.toHaveBeenCalled();
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
      expect(mockPrismaService.batch.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the cycle does not belong to the crop/user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue({
        id: 'crop1',
        ownerId: 'u1',
      });
      mockPrismaService.variety.findFirst.mockResolvedValue({
        id: 'variety1',
        cropId: 'crop1',
      });
      mockPrismaService.cycle.findFirst.mockResolvedValue(null);

      await expect(service.create('u1', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.batch.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it("returns only the requesting user's batches", async () => {
      const batches = [{ id: 'b1', ownerId: 'u1' }];
      mockPrismaService.batch.findMany.mockResolvedValue(batches);

      const result = await service.findAll('u1');

      expect(mockPrismaService.batch.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'u1' },
      });
      expect(result).toEqual(batches);
    });
  });

  describe('findOne', () => {
    it('returns the batch with its milestone progress ordered and its activity log merged in', async () => {
      const batch = {
        id: 'b1',
        ownerId: 'u1',
        milestoneProgress: [{ id: 'p1', order: 1 }],
      };
      mockPrismaService.batch.findFirst.mockResolvedValue(batch);
      const activityLog = [{ batchId: 'b1', note: 'Looking healthy' }];
      const sort = stubActivityLog(activityLog);

      const result = await service.findOne('u1', 'b1');

      expect(mockPrismaService.batch.findFirst).toHaveBeenCalledWith({
        where: { id: 'b1', ownerId: 'u1' },
        include: {
          milestoneProgress: {
            orderBy: { order: 'asc' },
            include: { milestone: true },
          },
        },
      });
      expect(mockActivityLogModel.find).toHaveBeenCalledWith({
        batchId: 'b1',
      });
      expect(sort).toHaveBeenCalledWith({ loggedAt: 1 });
      expect(result).toEqual({ ...batch, activityLog });
    });

    it('throws NotFoundException when the batch does not exist or is not owned by the user', async () => {
      mockPrismaService.batch.findFirst.mockResolvedValue(null);

      await expect(service.findOne('u1', 'b1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addActivity', () => {
    it('logs a freeform activity note for a batch owned by the requesting Grower', async () => {
      mockPrismaService.batch.findFirst.mockResolvedValue({
        id: 'b1',
        ownerId: 'u1',
      });
      const created = { batchId: 'b1', note: 'Watered', photos: [] };
      mockActivityLogModel.create.mockResolvedValue(created);

      const result = await service.addActivity('u1', 'b1', {
        note: 'Watered',
      });

      expect(mockPrismaService.batch.findFirst).toHaveBeenCalledWith({
        where: { id: 'b1', ownerId: 'u1' },
      });
      expect(mockActivityLogModel.create).toHaveBeenCalledWith({
        batchId: 'b1',
        note: 'Watered',
        photos: [],
      });
      expect(result).toEqual(created);
    });

    it('passes through provided photos instead of defaulting them', async () => {
      mockPrismaService.batch.findFirst.mockResolvedValue({
        id: 'b1',
        ownerId: 'u1',
      });
      mockActivityLogModel.create.mockResolvedValue({});

      await service.addActivity('u1', 'b1', {
        note: 'Watered',
        photos: ['https://example.com/photo.jpg'],
      });

      expect(mockActivityLogModel.create).toHaveBeenCalledWith({
        batchId: 'b1',
        note: 'Watered',
        photos: ['https://example.com/photo.jpg'],
      });
    });

    it('throws NotFoundException when the batch does not exist or is not owned by the user', async () => {
      mockPrismaService.batch.findFirst.mockResolvedValue(null);

      await expect(
        service.addActivity('u1', 'b1', { note: 'Watered' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockActivityLogModel.create).not.toHaveBeenCalled();
    });
  });

  describe('advanceMilestone', () => {
    it("advances the batch to its next milestone and stamps the progress row's reachedAt", async () => {
      const batch = { id: 'b1', ownerId: 'u1', currentMilestoneOrder: 0 };
      mockPrismaService.batch.findFirst.mockResolvedValue(batch);
      mockPrismaService.batchMilestoneProgress.findFirst.mockResolvedValue({
        id: 'p1',
        batchId: 'b1',
        order: 1,
      });
      mockPrismaService.batchMilestoneProgress.update.mockReturnValue(
        'progress-update-op',
      );
      mockPrismaService.batch.update.mockReturnValue('batch-update-op');
      const updatedBatch = { ...batch, currentMilestoneOrder: 1 };
      mockPrismaService.$transaction.mockResolvedValue([
        'progress-result',
        updatedBatch,
      ]);

      const result = await service.advanceMilestone('u1', 'b1', {
        reachedAt: '2026-01-05',
      });

      expect(
        mockPrismaService.batchMilestoneProgress.findFirst,
      ).toHaveBeenCalledWith({
        where: { batchId: 'b1', order: 1 },
      });
      expect(
        mockPrismaService.batchMilestoneProgress.update,
      ).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { reachedAt: new Date('2026-01-05') },
      });
      expect(mockPrismaService.batch.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { currentMilestoneOrder: 1 },
      });
      expect(result).toEqual(updatedBatch);
    });

    it('throws NotFoundException when the batch does not exist or is not owned by the user', async () => {
      mockPrismaService.batch.findFirst.mockResolvedValue(null);

      await expect(
        service.advanceMilestone('u1', 'b1', { reachedAt: '2026-01-05' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException when there is no further milestone to advance to', async () => {
      const batch = { id: 'b1', ownerId: 'u1', currentMilestoneOrder: 2 };
      mockPrismaService.batch.findFirst.mockResolvedValue(batch);
      mockPrismaService.batchMilestoneProgress.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.advanceMilestone('u1', 'b1', { reachedAt: '2026-01-05' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('confirmHarvest', () => {
    beforeEach(() => {
      mockPrismaService.$transaction.mockImplementation(
        (cb: (tx: typeof mockPrismaService) => unknown) =>
          cb(mockPrismaService),
      );
      mockPrismaService.preBooking.findMany.mockResolvedValue([]);
    });

    it('confirms the harvest, publishing the draft Listing with the actual yield', async () => {
      const batch = {
        id: 'b1',
        ownerId: 'u1',
        currentMilestoneOrder: 2,
        harvestConfirmed: false,
        milestoneProgress: [{ order: 1 }, { order: 2 }],
      };
      mockPrismaService.batch.findFirst.mockResolvedValue(batch);
      mockPrismaService.listing.findFirst.mockResolvedValue({
        id: 'l1',
        batchId: 'b1',
      });
      const updated = {
        ...batch,
        actualYield: 75,
        harvestConfirmed: true,
      };
      mockPrismaService.batch.update.mockResolvedValue(updated);

      const result = await service.confirmHarvest('u1', 'b1', {
        actualYield: 75,
      });

      expect(mockPrismaService.listing.findFirst).toHaveBeenCalledWith({
        where: { batchId: 'b1' },
      });
      expect(mockPrismaService.batch.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { actualYield: 75, harvestConfirmed: true },
      });
      expect(mockPrismaService.listing.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { availableQuantity: 75, isPublished: true },
      });
      expect(result).toEqual(updated);
    });

    it('transitions QUEUED pre-bookings to AWAITING_PAYMENT with a 20% advance and a 48h Redis hold', async () => {
      const batch = {
        id: 'b1',
        ownerId: 'u1',
        currentMilestoneOrder: 2,
        harvestConfirmed: false,
        milestoneProgress: [{ order: 1 }, { order: 2 }],
      };
      mockPrismaService.batch.findFirst.mockResolvedValue(batch);
      mockPrismaService.listing.findFirst.mockResolvedValue({
        id: 'l1',
        batchId: 'b1',
        wholesalePrice: decimal(35),
      });
      mockPrismaService.batch.update.mockResolvedValue({
        ...batch,
        actualYield: 75,
        harvestConfirmed: true,
      });
      const queuedPreBooking = { id: 'pb1', quantity: decimal(20) };
      mockPrismaService.preBooking.findMany.mockResolvedValue([
        queuedPreBooking,
      ]);

      await service.confirmHarvest('u1', 'b1', { actualYield: 75 });

      expect(mockPrismaService.preBooking.findMany).toHaveBeenCalledWith({
        where: { batchId: 'b1', status: PreBookingStatus.QUEUED },
      });
      expect(mockPrismaService.preBooking.update).toHaveBeenCalledWith({
        where: { id: 'pb1' },
        data: {
          status: PreBookingStatus.AWAITING_PAYMENT,
          listingId: 'l1',
          advanceAmount: 140,
          holdExpiresAt: expect.any(Date) as Date,
        },
      });
      expect(mockRedisService.setPaymentHold).toHaveBeenCalledWith(
        'pb1',
        48 * 60 * 60,
      );
    });

    it('throws ConflictException when no draft Listing exists for the batch', async () => {
      const batch = {
        id: 'b1',
        ownerId: 'u1',
        currentMilestoneOrder: 2,
        harvestConfirmed: false,
        milestoneProgress: [{ order: 1 }, { order: 2 }],
      };
      mockPrismaService.batch.findFirst.mockResolvedValue(batch);
      mockPrismaService.listing.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmHarvest('u1', 'b1', { actualYield: 75 }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.batch.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the batch does not exist or is not owned by the user', async () => {
      mockPrismaService.batch.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmHarvest('u1', 'b1', { actualYield: 75 }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.batch.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the batch has not reached its final milestone yet', async () => {
      const batch = {
        id: 'b1',
        ownerId: 'u1',
        currentMilestoneOrder: 1,
        harvestConfirmed: false,
        milestoneProgress: [{ order: 1 }, { order: 2 }],
      };
      mockPrismaService.batch.findFirst.mockResolvedValue(batch);

      await expect(
        service.confirmHarvest('u1', 'b1', { actualYield: 75 }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.batch.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the harvest has already been confirmed', async () => {
      const batch = {
        id: 'b1',
        ownerId: 'u1',
        currentMilestoneOrder: 2,
        harvestConfirmed: true,
        milestoneProgress: [{ order: 1 }, { order: 2 }],
      };
      mockPrismaService.batch.findFirst.mockResolvedValue(batch);

      await expect(
        service.confirmHarvest('u1', 'b1', { actualYield: 75 }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.batch.update).not.toHaveBeenCalled();
    });
  });

  describe('getTimeline', () => {
    it('returns the batch with its milestone progress for public viewing', async () => {
      const batch = {
        id: 'b1',
        milestoneProgress: [{ id: 'p1', order: 1 }],
      };
      mockPrismaService.batch.findUnique.mockResolvedValue(batch);

      const result = await service.getTimeline('b1');

      expect(mockPrismaService.batch.findUnique).toHaveBeenCalledWith({
        where: { id: 'b1' },
        include: {
          milestoneProgress: {
            orderBy: { order: 'asc' },
            include: { milestone: true },
          },
        },
      });
      expect(result).toEqual(batch);
    });

    it('throws NotFoundException when the batch does not exist', async () => {
      mockPrismaService.batch.findUnique.mockResolvedValue(null);

      await expect(service.getTimeline('b1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
