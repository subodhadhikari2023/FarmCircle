import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CyclesService', () => {
  let service: CyclesService;

  const mockPrismaService = {
    crop: {
      findFirst: jest.fn(),
    },
    cycle: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    milestone: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CyclesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CyclesService>(CyclesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a cycle for a crop owned by the requesting user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue({
        id: 'crop1',
        ownerId: 'u1',
        name: 'Tomato',
      });
      const created = {
        id: 'cy1',
        ownerId: 'u1',
        cropId: 'crop1',
        name: 'Standard',
      };
      mockPrismaService.cycle.create.mockResolvedValue(created);

      const result = await service.create('u1', {
        cropId: 'crop1',
        name: 'Standard',
      });

      expect(mockPrismaService.crop.findFirst).toHaveBeenCalledWith({
        where: { id: 'crop1', ownerId: 'u1' },
      });
      expect(mockPrismaService.cycle.create).toHaveBeenCalledWith({
        data: { ownerId: 'u1', cropId: 'crop1', name: 'Standard' },
      });
      expect(result).toEqual(created);
    });

    it('throws NotFoundException when the crop does not exist or is not owned by the user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue(null);

      await expect(
        service.create('u1', { cropId: 'crop1', name: 'Standard' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.cycle.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it("returns only the requesting user's cycles", async () => {
      const cycles = [
        { id: 'cy1', ownerId: 'u1', cropId: 'crop1', name: 'Standard' },
      ];
      mockPrismaService.cycle.findMany.mockResolvedValue(cycles);

      const result = await service.findAll('u1');

      expect(mockPrismaService.cycle.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'u1' },
      });
      expect(result).toEqual(cycles);
    });

    it('filters by cropId when provided', async () => {
      const cycles = [
        { id: 'cy1', ownerId: 'u1', cropId: 'crop1', name: 'Standard' },
      ];
      mockPrismaService.cycle.findMany.mockResolvedValue(cycles);

      const result = await service.findAll('u1', 'crop1');

      expect(mockPrismaService.cycle.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'u1', cropId: 'crop1' },
      });
      expect(result).toEqual(cycles);
    });
  });

  describe('findOne', () => {
    it('returns the cycle with its milestones ordered', async () => {
      const cycle = {
        id: 'cy1',
        ownerId: 'u1',
        cropId: 'crop1',
        name: 'Standard',
        milestones: [{ id: 'm1', order: 1 }],
      };
      mockPrismaService.cycle.findFirst.mockResolvedValue(cycle);

      const result = await service.findOne('u1', 'cy1');

      expect(mockPrismaService.cycle.findFirst).toHaveBeenCalledWith({
        where: { id: 'cy1', ownerId: 'u1' },
        include: { milestones: { orderBy: { order: 'asc' } } },
      });
      expect(result).toEqual(cycle);
    });

    it('throws NotFoundException when the cycle does not exist or is not owned by the user', async () => {
      mockPrismaService.cycle.findFirst.mockResolvedValue(null);

      await expect(service.findOne('u1', 'cy1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates the cycle name', async () => {
      const cycle = {
        id: 'cy1',
        ownerId: 'u1',
        cropId: 'crop1',
        name: 'Standard',
      };
      mockPrismaService.cycle.findFirst.mockResolvedValue(cycle);
      const updated = { ...cycle, name: 'Fast-track' };
      mockPrismaService.cycle.update.mockResolvedValue(updated);

      const result = await service.update('u1', 'cy1', {
        name: 'Fast-track',
      });

      expect(mockPrismaService.cycle.update).toHaveBeenCalledWith({
        where: { id: 'cy1' },
        data: { name: 'Fast-track' },
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when the cycle does not exist or is not owned by the user', async () => {
      mockPrismaService.cycle.findFirst.mockResolvedValue(null);

      await expect(
        service.update('u1', 'cy1', { name: 'Fast-track' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.cycle.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the cycle and its milestones in a transaction when no batches use it', async () => {
      const cycle = {
        id: 'cy1',
        ownerId: 'u1',
        cropId: 'crop1',
        name: 'Standard',
        _count: { batches: 0 },
      };
      mockPrismaService.cycle.findFirst.mockResolvedValue(cycle);
      mockPrismaService.milestone.deleteMany.mockReturnValue('deleteMany-op');
      mockPrismaService.cycle.delete.mockReturnValue('delete-op');
      mockPrismaService.$transaction.mockResolvedValue(undefined);

      await service.remove('u1', 'cy1');

      expect(mockPrismaService.milestone.deleteMany).toHaveBeenCalledWith({
        where: { cycleId: 'cy1' },
      });
      expect(mockPrismaService.cycle.delete).toHaveBeenCalledWith({
        where: { id: 'cy1' },
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalledWith([
        'deleteMany-op',
        'delete-op',
      ]);
    });

    it('throws NotFoundException when the cycle does not exist or is not owned by the user', async () => {
      mockPrismaService.cycle.findFirst.mockResolvedValue(null);

      await expect(service.remove('u1', 'cy1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the cycle is in use by a batch', async () => {
      const cycle = {
        id: 'cy1',
        ownerId: 'u1',
        cropId: 'crop1',
        name: 'Standard',
        _count: { batches: 2 },
      };
      mockPrismaService.cycle.findFirst.mockResolvedValue(cycle);

      await expect(service.remove('u1', 'cy1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });
});
