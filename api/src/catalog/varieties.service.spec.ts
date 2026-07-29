import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { VarietiesService } from './varieties.service';
import { PrismaService } from '../prisma/prisma.service';

describe('VarietiesService', () => {
  let service: VarietiesService;

  const mockPrismaService = {
    crop: {
      findFirst: jest.fn(),
    },
    variety: {
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
        VarietiesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<VarietiesService>(VarietiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a variety under a crop owned by the requesting user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue({
        id: 'c1',
        ownerId: 'u1',
        name: 'Tomato',
      });
      mockPrismaService.variety.findFirst.mockResolvedValue(null);
      const created = { id: 'v1', cropId: 'c1', name: 'Cherry' };
      mockPrismaService.variety.create.mockResolvedValue(created);

      const result = await service.create('u1', 'c1', { name: 'Cherry' });

      expect(mockPrismaService.crop.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', ownerId: 'u1' },
      });
      expect(mockPrismaService.variety.findFirst).toHaveBeenCalledWith({
        where: { cropId: 'c1', name: 'Cherry' },
      });
      expect(mockPrismaService.variety.create).toHaveBeenCalledWith({
        data: { cropId: 'c1', name: 'Cherry' },
      });
      expect(result).toEqual(created);
    });

    it('throws NotFoundException when the crop does not exist or is not owned by the user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue(null);

      await expect(
        service.create('u1', 'c1', { name: 'Cherry' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.variety.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException if the crop already has a variety with this name', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue({
        id: 'c1',
        ownerId: 'u1',
        name: 'Tomato',
      });
      mockPrismaService.variety.findFirst.mockResolvedValue({
        id: 'v1',
        cropId: 'c1',
        name: 'Cherry',
      });

      await expect(
        service.create('u1', 'c1', { name: 'Cherry' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.variety.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllByCrop', () => {
    it('returns varieties for a crop owned by the requesting user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue({
        id: 'c1',
        ownerId: 'u1',
        name: 'Tomato',
      });
      const varieties = [{ id: 'v1', cropId: 'c1', name: 'Cherry' }];
      mockPrismaService.variety.findMany.mockResolvedValue(varieties);

      const result = await service.findAllByCrop('u1', 'c1');

      expect(mockPrismaService.variety.findMany).toHaveBeenCalledWith({
        where: { cropId: 'c1' },
      });
      expect(result).toEqual(varieties);
    });

    it('throws NotFoundException when the crop does not exist or is not owned by the user', async () => {
      mockPrismaService.crop.findFirst.mockResolvedValue(null);

      await expect(service.findAllByCrop('u1', 'c1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates the variety name', async () => {
      const variety = { id: 'v1', cropId: 'c1', name: 'Cherry' };
      mockPrismaService.variety.findFirst
        .mockResolvedValueOnce(variety) // ownership lookup
        .mockResolvedValueOnce(null); // duplicate-name check
      const updated = { ...variety, name: 'Roma' };
      mockPrismaService.variety.update.mockResolvedValue(updated);

      const result = await service.update('u1', 'v1', { name: 'Roma' });

      expect(mockPrismaService.variety.findFirst).toHaveBeenNthCalledWith(1, {
        where: { id: 'v1', crop: { ownerId: 'u1' } },
      });
      expect(mockPrismaService.variety.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { name: 'Roma' },
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when the variety does not exist or its crop is not owned by the user', async () => {
      mockPrismaService.variety.findFirst.mockResolvedValue(null);

      await expect(
        service.update('u1', 'v1', { name: 'Roma' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.variety.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException when renaming to a name already used by another variety in the same crop', async () => {
      const variety = { id: 'v1', cropId: 'c1', name: 'Cherry' };
      mockPrismaService.variety.findFirst
        .mockResolvedValueOnce(variety)
        .mockResolvedValueOnce({ id: 'v2', cropId: 'c1', name: 'Roma' });

      await expect(
        service.update('u1', 'v1', { name: 'Roma' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.variety.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the variety when it has no dependent batches or listings', async () => {
      const variety = {
        id: 'v1',
        cropId: 'c1',
        name: 'Cherry',
        _count: { batches: 0, listings: 0 },
      };
      mockPrismaService.variety.findFirst.mockResolvedValue(variety);

      await service.remove('u1', 'v1');

      expect(mockPrismaService.variety.delete).toHaveBeenCalledWith({
        where: { id: 'v1' },
      });
    });

    it('throws NotFoundException when the variety does not exist or its crop is not owned by the user', async () => {
      mockPrismaService.variety.findFirst.mockResolvedValue(null);

      await expect(service.remove('u1', 'v1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.variety.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the variety has dependent batches or listings', async () => {
      const variety = {
        id: 'v1',
        cropId: 'c1',
        name: 'Cherry',
        _count: { batches: 1, listings: 0 },
      };
      mockPrismaService.variety.findFirst.mockResolvedValue(variety);

      await expect(service.remove('u1', 'v1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.variety.delete).not.toHaveBeenCalled();
    });
  });
});
