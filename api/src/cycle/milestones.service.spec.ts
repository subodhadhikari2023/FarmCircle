import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MilestonesService', () => {
  let service: MilestonesService;

  const mockPrismaService = {
    cycle: {
      findFirst: jest.fn(),
    },
    milestone: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    batchMilestoneProgress: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MilestonesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MilestonesService>(MilestonesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a milestone under a cycle owned by the requesting user', async () => {
      mockPrismaService.cycle.findFirst.mockResolvedValue({
        id: 'cy1',
        ownerId: 'u1',
        name: 'Standard',
      });
      mockPrismaService.milestone.findFirst.mockResolvedValue(null);
      const created = {
        id: 'm1',
        cycleId: 'cy1',
        name: 'Sown',
        order: 1,
        expectedDurationDays: 5,
      };
      mockPrismaService.milestone.create.mockResolvedValue(created);

      const result = await service.create('u1', 'cy1', {
        name: 'Sown',
        order: 1,
        expectedDurationDays: 5,
      });

      expect(mockPrismaService.cycle.findFirst).toHaveBeenCalledWith({
        where: { id: 'cy1', ownerId: 'u1' },
      });
      expect(mockPrismaService.milestone.findFirst).toHaveBeenCalledWith({
        where: { cycleId: 'cy1', order: 1 },
      });
      expect(mockPrismaService.milestone.create).toHaveBeenCalledWith({
        data: {
          cycleId: 'cy1',
          name: 'Sown',
          order: 1,
          expectedDurationDays: 5,
        },
      });
      expect(result).toEqual(created);
    });

    it('throws NotFoundException when the cycle does not exist or is not owned by the user', async () => {
      mockPrismaService.cycle.findFirst.mockResolvedValue(null);

      await expect(
        service.create('u1', 'cy1', {
          name: 'Sown',
          order: 1,
          expectedDurationDays: 5,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.milestone.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the cycle already has a milestone at this order', async () => {
      mockPrismaService.cycle.findFirst.mockResolvedValue({
        id: 'cy1',
        ownerId: 'u1',
        name: 'Standard',
      });
      mockPrismaService.milestone.findFirst.mockResolvedValue({
        id: 'm1',
        cycleId: 'cy1',
        order: 1,
      });

      await expect(
        service.create('u1', 'cy1', {
          name: 'Sown',
          order: 1,
          expectedDurationDays: 5,
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.milestone.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates the milestone fields without checking for order conflicts when order is unchanged', async () => {
      const milestone = {
        id: 'm1',
        cycleId: 'cy1',
        name: 'Sown',
        order: 1,
        expectedDurationDays: 5,
      };
      mockPrismaService.milestone.findFirst.mockResolvedValue(milestone);
      const updated = { ...milestone, expectedDurationDays: 7 };
      mockPrismaService.milestone.update.mockResolvedValue(updated);

      const result = await service.update('u1', 'm1', {
        expectedDurationDays: 7,
      });

      expect(mockPrismaService.milestone.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.milestone.findFirst).toHaveBeenCalledWith({
        where: { id: 'm1', cycle: { ownerId: 'u1' } },
      });
      expect(mockPrismaService.milestone.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { name: undefined, order: undefined, expectedDurationDays: 7 },
      });
      expect(result).toEqual(updated);
    });

    it('reorders the milestone when the new order is free within the cycle', async () => {
      const milestone = {
        id: 'm1',
        cycleId: 'cy1',
        name: 'Sown',
        order: 1,
        expectedDurationDays: 5,
      };
      mockPrismaService.milestone.findFirst
        .mockResolvedValueOnce(milestone) // ownership lookup
        .mockResolvedValueOnce(null); // duplicate-order check
      const updated = { ...milestone, order: 2 };
      mockPrismaService.milestone.update.mockResolvedValue(updated);

      const result = await service.update('u1', 'm1', { order: 2 });

      expect(mockPrismaService.milestone.findFirst).toHaveBeenNthCalledWith(2, {
        where: { cycleId: 'cy1', order: 2, NOT: { id: 'm1' } },
      });
      expect(result).toEqual(updated);
    });

    it('is allowed even when batches already exist against the cycle', async () => {
      const milestone = {
        id: 'm1',
        cycleId: 'cy1',
        name: 'Sown',
        order: 1,
        expectedDurationDays: 5,
      };
      mockPrismaService.milestone.findFirst.mockResolvedValue(milestone);
      mockPrismaService.milestone.update.mockResolvedValue(milestone);

      await service.update('u1', 'm1', { name: 'Planted' });

      expect(mockPrismaService.milestone.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when the milestone does not exist or its cycle is not owned by the user', async () => {
      mockPrismaService.milestone.findFirst.mockResolvedValue(null);

      await expect(
        service.update('u1', 'm1', { name: 'Planted' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.milestone.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when reordering to an order already used by another milestone in the same cycle', async () => {
      const milestone = {
        id: 'm1',
        cycleId: 'cy1',
        name: 'Sown',
        order: 1,
        expectedDurationDays: 5,
      };
      mockPrismaService.milestone.findFirst
        .mockResolvedValueOnce(milestone)
        .mockResolvedValueOnce({ id: 'm2', cycleId: 'cy1', order: 2 });

      await expect(service.update('u1', 'm1', { order: 2 })).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.milestone.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the milestone when no batch has reached it', async () => {
      const milestone = { id: 'm1', cycleId: 'cy1', order: 1 };
      mockPrismaService.milestone.findFirst.mockResolvedValue(milestone);
      mockPrismaService.batchMilestoneProgress.findFirst.mockResolvedValue(
        null,
      );

      await service.remove('u1', 'm1');

      expect(
        mockPrismaService.batchMilestoneProgress.findFirst,
      ).toHaveBeenCalledWith({
        where: { milestoneId: 'm1', reachedAt: { not: null } },
      });
      expect(mockPrismaService.milestone.delete).toHaveBeenCalledWith({
        where: { id: 'm1' },
      });
    });

    it('throws NotFoundException when the milestone does not exist or its cycle is not owned by the user', async () => {
      mockPrismaService.milestone.findFirst.mockResolvedValue(null);

      await expect(service.remove('u1', 'm1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.milestone.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a batch has already progressed past it', async () => {
      const milestone = { id: 'm1', cycleId: 'cy1', order: 1 };
      mockPrismaService.milestone.findFirst.mockResolvedValue(milestone);
      mockPrismaService.batchMilestoneProgress.findFirst.mockResolvedValue({
        id: 'p1',
        milestoneId: 'm1',
        reachedAt: new Date('2026-01-01'),
      });

      await expect(service.remove('u1', 'm1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.milestone.delete).not.toHaveBeenCalled();
    });
  });
});
