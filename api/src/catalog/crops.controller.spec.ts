import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { CropsController } from './crops.controller';
import { CropsService } from './crops.service';
import { VarietiesService } from './varieties.service';

describe('CropsController', () => {
  let controller: CropsController;

  const mockCropsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockVarietiesService = {
    create: jest.fn(),
    findAllByCrop: jest.fn(),
  };

  const mockRequest = {
    user: { id: 'u1', role: 'GROWER' },
  } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CropsController],
      providers: [
        { provide: CropsService, useValue: mockCropsService },
        { provide: VarietiesService, useValue: mockVarietiesService },
      ],
    }).compile();

    controller = module.get<CropsController>(CropsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it("delegates to cropsService.create with the authenticated user's id and dto", async () => {
      const dto = { name: 'Tomato' };
      const crop = { id: 'c1', ownerId: 'u1', name: 'Tomato' };
      mockCropsService.create.mockResolvedValue(crop);

      const result = await controller.create(mockRequest, dto);

      expect(mockCropsService.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(crop);
    });
  });

  describe('findAll', () => {
    it("delegates to cropsService.findAll with the authenticated user's id", async () => {
      const crops = [{ id: 'c1', ownerId: 'u1', name: 'Tomato' }];
      mockCropsService.findAll.mockResolvedValue(crops);

      const result = await controller.findAll(mockRequest);

      expect(mockCropsService.findAll).toHaveBeenCalledWith('u1');
      expect(result).toEqual(crops);
    });
  });

  describe('findOne', () => {
    it("delegates to cropsService.findOne with the authenticated user's id and the id param", async () => {
      const crop = { id: 'c1', ownerId: 'u1', name: 'Tomato' };
      mockCropsService.findOne.mockResolvedValue(crop);

      const result = await controller.findOne(mockRequest, 'c1');

      expect(mockCropsService.findOne).toHaveBeenCalledWith('u1', 'c1');
      expect(result).toEqual(crop);
    });
  });

  describe('update', () => {
    it("delegates to cropsService.update with the authenticated user's id, the id param, and dto", async () => {
      const dto = { name: 'Heirloom Tomato' };
      const crop = { id: 'c1', ownerId: 'u1', name: 'Heirloom Tomato' };
      mockCropsService.update.mockResolvedValue(crop);

      const result = await controller.update(mockRequest, 'c1', dto);

      expect(mockCropsService.update).toHaveBeenCalledWith('u1', 'c1', dto);
      expect(result).toEqual(crop);
    });
  });

  describe('remove', () => {
    it("delegates to cropsService.remove with the authenticated user's id and the id param", async () => {
      mockCropsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(mockRequest, 'c1');

      expect(mockCropsService.remove).toHaveBeenCalledWith('u1', 'c1');
      expect(result).toBeUndefined();
    });
  });

  describe('createVariety', () => {
    it("delegates to varietiesService.create with the authenticated user's id, the crop id param, and dto", async () => {
      const dto = { name: 'Cherry' };
      const variety = { id: 'v1', cropId: 'c1', name: 'Cherry' };
      mockVarietiesService.create.mockResolvedValue(variety);

      const result = await controller.createVariety(mockRequest, 'c1', dto);

      expect(mockVarietiesService.create).toHaveBeenCalledWith('u1', 'c1', dto);
      expect(result).toEqual(variety);
    });
  });

  describe('findAllVarieties', () => {
    it("delegates to varietiesService.findAllByCrop with the authenticated user's id and the crop id param", async () => {
      const varieties = [{ id: 'v1', cropId: 'c1', name: 'Cherry' }];
      mockVarietiesService.findAllByCrop.mockResolvedValue(varieties);

      const result = await controller.findAllVarieties(mockRequest, 'c1');

      expect(mockVarietiesService.findAllByCrop).toHaveBeenCalledWith(
        'u1',
        'c1',
      );
      expect(result).toEqual(varieties);
    });
  });
});
