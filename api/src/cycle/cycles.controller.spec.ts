import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { CyclesController } from './cycles.controller';
import { CyclesService } from './cycles.service';
import { MilestonesService } from './milestones.service';

describe('CyclesController', () => {
  let controller: CyclesController;

  const mockCyclesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockMilestonesService = {
    create: jest.fn(),
  };

  const mockRequest = {
    user: { id: 'u1', role: 'GROWER' },
  } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CyclesController],
      providers: [
        { provide: CyclesService, useValue: mockCyclesService },
        { provide: MilestonesService, useValue: mockMilestonesService },
      ],
    }).compile();

    controller = module.get<CyclesController>(CyclesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it("delegates to cyclesService.create with the authenticated user's id and dto", async () => {
      const dto = { cropId: 'crop1', name: 'Standard' };
      const cycle = { id: 'cy1', ownerId: 'u1', ...dto };
      mockCyclesService.create.mockResolvedValue(cycle);

      const result = await controller.create(mockRequest, dto);

      expect(mockCyclesService.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(cycle);
    });
  });

  describe('findAll', () => {
    it("delegates to cyclesService.findAll with the authenticated user's id and no cropId", async () => {
      const cycles = [{ id: 'cy1', ownerId: 'u1', cropId: 'crop1' }];
      mockCyclesService.findAll.mockResolvedValue(cycles);

      const result = await controller.findAll(mockRequest, undefined);

      expect(mockCyclesService.findAll).toHaveBeenCalledWith('u1', undefined);
      expect(result).toEqual(cycles);
    });

    it('passes the cropId query param through', async () => {
      const cycles = [{ id: 'cy1', ownerId: 'u1', cropId: 'crop1' }];
      mockCyclesService.findAll.mockResolvedValue(cycles);

      const result = await controller.findAll(mockRequest, 'crop1');

      expect(mockCyclesService.findAll).toHaveBeenCalledWith('u1', 'crop1');
      expect(result).toEqual(cycles);
    });
  });

  describe('findOne', () => {
    it("delegates to cyclesService.findOne with the authenticated user's id and the id param", async () => {
      const cycle = { id: 'cy1', ownerId: 'u1', cropId: 'crop1' };
      mockCyclesService.findOne.mockResolvedValue(cycle);

      const result = await controller.findOne(mockRequest, 'cy1');

      expect(mockCyclesService.findOne).toHaveBeenCalledWith('u1', 'cy1');
      expect(result).toEqual(cycle);
    });
  });

  describe('update', () => {
    it("delegates to cyclesService.update with the authenticated user's id, the id param, and dto", async () => {
      const dto = { name: 'Fast-track' };
      const cycle = { id: 'cy1', ownerId: 'u1', cropId: 'crop1', ...dto };
      mockCyclesService.update.mockResolvedValue(cycle);

      const result = await controller.update(mockRequest, 'cy1', dto);

      expect(mockCyclesService.update).toHaveBeenCalledWith('u1', 'cy1', dto);
      expect(result).toEqual(cycle);
    });
  });

  describe('remove', () => {
    it("delegates to cyclesService.remove with the authenticated user's id and the id param", async () => {
      mockCyclesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(mockRequest, 'cy1');

      expect(mockCyclesService.remove).toHaveBeenCalledWith('u1', 'cy1');
      expect(result).toBeUndefined();
    });
  });

  describe('createMilestone', () => {
    it("delegates to milestonesService.create with the authenticated user's id, the cycle id param, and dto", async () => {
      const dto = { name: 'Sown', order: 1, expectedDurationDays: 5 };
      const milestone = { id: 'm1', cycleId: 'cy1', ...dto };
      mockMilestonesService.create.mockResolvedValue(milestone);

      const result = await controller.createMilestone(mockRequest, 'cy1', dto);

      expect(mockMilestonesService.create).toHaveBeenCalledWith(
        'u1',
        'cy1',
        dto,
      );
      expect(result).toEqual(milestone);
    });
  });
});
