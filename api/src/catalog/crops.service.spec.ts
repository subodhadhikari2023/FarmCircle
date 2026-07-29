import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CropsService } from './crops.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CropsService', () => {
  let service: CropsService;

  const mockPrismaService = {
    crop: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CropsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CropsService>(CropsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a crop owned by the requesting user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue(null);
      const created = { id: 'c1', ownerId: 'u1', name: 'Tomato' };
      mockPrismaService.crop.create.mockResolvedValue(created);

      const result = await service.create('u1', { name: 'Tomato' });

      expect(mockPrismaService.crop.findFirst).toHaveBeenCalledWith({
        where: { ownerId: 'u1', name: 'Tomato' },
      });
      expect(mockPrismaService.crop.create).toHaveBeenCalledWith({
        data: { ownerId: 'u1', name: 'Tomato' },
      });
      expect(result).toEqual(created);
    });

    it('throws ConflictException if the user already has a crop with this name', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue({
        id: 'c1',
        ownerId: 'u1',
        name: 'Tomato',
      });

      await expect(service.create('u1', { name: 'Tomato' })).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.crop.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it("returns only the requesting user's crops", async () => {
      const crops = [{ id: 'c1', ownerId: 'u1', name: 'Tomato' }];
      mockPrismaService.crop.findMany.mockResolvedValue(crops);

      const result = await service.findAll('u1');

      expect(mockPrismaService.crop.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'u1' },
      });
      expect(result).toEqual(crops);
    });
  });

  describe('findOne', () => {
    it('returns the crop when owned by the requesting user', async () => {
      const crop = { id: 'c1', ownerId: 'u1', name: 'Tomato' };
      mockPrismaService.crop.findFirst.mockResolvedValue(crop);

      const result = await service.findOne('u1', 'c1');

      expect(mockPrismaService.crop.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', ownerId: 'u1' },
      });
      expect(result).toEqual(crop);
    });

    it('throws NotFoundException when the crop does not exist or is not owned by the user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue(null);

      await expect(service.findOne('u1', 'c1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates the crop name', async () => {
      const crop = { id: 'c1', ownerId: 'u1', name: 'Tomato' };
      mockPrismaService.crop.findFirst
        .mockResolvedValueOnce(crop) // ownership lookup
        .mockResolvedValueOnce(null); // duplicate-name check
      const updated = { ...crop, name: 'Heirloom Tomato' };
      mockPrismaService.crop.update.mockResolvedValue(updated);

      const result = await service.update('u1', 'c1', {
        name: 'Heirloom Tomato',
      });

      expect(mockPrismaService.crop.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { name: 'Heirloom Tomato' },
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when the crop does not exist or is not owned by the user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue(null);

      await expect(
        service.update('u1', 'c1', { name: 'Heirloom Tomato' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.crop.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when renaming to a name already used by another crop', async () => {
      const crop = { id: 'c1', ownerId: 'u1', name: 'Tomato' };
      mockPrismaService.crop.findFirst
        .mockResolvedValueOnce(crop) // ownership lookup
        .mockResolvedValueOnce({ id: 'c2', ownerId: 'u1', name: 'Potato' }); // duplicate-name check

      await expect(
        service.update('u1', 'c1', { name: 'Potato' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.crop.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the crop when it has no dependent varieties, cycles, batches, or listings', async () => {
      const crop = {
        id: 'c1',
        ownerId: 'u1',
        name: 'Tomato',
        _count: { varieties: 0, cycles: 0, batches: 0, listings: 0 },
      };
      mockPrismaService.crop.findFirst.mockResolvedValue(crop);

      await service.remove('u1', 'c1');

      expect(mockPrismaService.crop.delete).toHaveBeenCalledWith({
        where: { id: 'c1' },
      });
    });

    it('throws NotFoundException when the crop does not exist or is not owned by the user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue(null);

      await expect(service.remove('u1', 'c1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.crop.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the crop has dependent varieties', async () => {
      const crop = {
        id: 'c1',
        ownerId: 'u1',
        name: 'Tomato',
        _count: { varieties: 1, cycles: 0, batches: 0, listings: 0 },
      };
      mockPrismaService.crop.findFirst.mockResolvedValue(crop);

      await expect(service.remove('u1', 'c1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.crop.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the crop has dependent cycles, batches, or listings', async () => {
      const crop = {
        id: 'c1',
        ownerId: 'u1',
        name: 'Tomato',
        _count: { varieties: 0, cycles: 0, batches: 2, listings: 1 },
      };
      mockPrismaService.crop.findFirst.mockResolvedValue(crop);

      await expect(service.remove('u1', 'c1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.crop.delete).not.toHaveBeenCalled();
    });
  });
});
