import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    findMe: jest.fn(),
    updateMe: jest.fn(),
    listMyAddresses: jest.fn(),
    createAddress: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    suspend: jest.fn(),
    reactivate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe', () => {
    it("delegates to usersService.findMe with the authenticated user's id", async () => {
      const mockRequest = {
        user: { id: 'u1', role: 'CUSTOMER' },
      } as unknown as Request;
      const safeUser = {
        id: 'u1',
        name: 'Ann',
        email: 'ann@example.com',
        role: 'CUSTOMER',
        isSuspended: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      };
      mockUsersService.findMe.mockResolvedValue(safeUser);

      const result = await controller.getMe(mockRequest);

      expect(mockUsersService.findMe).toHaveBeenCalledWith('u1');
      expect(result).toEqual(safeUser);
    });
  });

  describe('updateMe', () => {
    it("delegates to usersService.updateMe with the authenticated user's id and dto", async () => {
      const mockRequest = {
        user: { id: 'u1', role: 'CUSTOMER' },
      } as unknown as Request;
      const dto = { name: 'Ann Updated' };
      const safeUser = {
        id: 'u1',
        name: 'Ann Updated',
        email: 'ann@example.com',
        role: 'CUSTOMER',
        isSuspended: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      };
      mockUsersService.updateMe.mockResolvedValue(safeUser);

      const result = await controller.updateMe(mockRequest, dto);

      expect(mockUsersService.updateMe).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(safeUser);
    });
  });

  describe('listMyAddresses', () => {
    it("delegates to usersService.listMyAddresses with the authenticated user's id", async () => {
      const mockRequest = {
        user: { id: 'u1', role: 'CUSTOMER' },
      } as unknown as Request;
      const addresses = [
        {
          id: 'a1',
          userId: 'u1',
          addressText: '123 Farm Lane',
          landmark: null,
          latitude: 12.9,
          longitude: 77.6,
          createdAt: new Date('2026-01-01'),
        },
      ];
      mockUsersService.listMyAddresses.mockResolvedValue(addresses);

      const result = await controller.listMyAddresses(mockRequest);

      expect(mockUsersService.listMyAddresses).toHaveBeenCalledWith('u1');
      expect(result).toEqual(addresses);
    });
  });

  describe('createAddress', () => {
    it("delegates to usersService.createAddress with the authenticated user's id and dto", async () => {
      const mockRequest = {
        user: { id: 'u1', role: 'CUSTOMER' },
      } as unknown as Request;
      const dto = {
        addressText: '123 Farm Lane',
        latitude: 12.9,
        longitude: 77.6,
      };
      const address = { id: 'a1', userId: 'u1', ...dto };
      mockUsersService.createAddress.mockResolvedValue(address);

      const result = await controller.createAddress(mockRequest, dto);

      expect(mockUsersService.createAddress).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(address);
    });
  });

  describe('findAll', () => {
    it('delegates to usersService.findAll', async () => {
      const safeUsers = [
        {
          id: 'u1',
          name: 'Vendor One',
          email: 'vendor@example.com',
          role: 'VENDOR',
          isSuspended: false,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ];
      mockUsersService.findAll.mockResolvedValue(safeUsers);

      const result = await controller.findAll();

      expect(mockUsersService.findAll).toHaveBeenCalled();
      expect(result).toEqual(safeUsers);
    });
  });

  describe('findOne', () => {
    it('delegates to usersService.findOne with the id param', async () => {
      const safeUser = {
        id: 'u1',
        name: 'Vendor One',
        email: 'vendor@example.com',
        role: 'VENDOR',
        isSuspended: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      };
      mockUsersService.findOne.mockResolvedValue(safeUser);

      const result = await controller.findOne('u1');

      expect(mockUsersService.findOne).toHaveBeenCalledWith('u1');
      expect(result).toEqual(safeUser);
    });
  });

  describe('suspend', () => {
    it('delegates to usersService.suspend with the id param', async () => {
      const safeUser = {
        id: 'u1',
        name: 'Vendor One',
        email: 'vendor@example.com',
        role: 'VENDOR',
        isSuspended: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      };
      mockUsersService.suspend.mockResolvedValue(safeUser);

      const result = await controller.suspend('u1');

      expect(mockUsersService.suspend).toHaveBeenCalledWith('u1');
      expect(result).toEqual(safeUser);
    });
  });

  describe('reactivate', () => {
    it('delegates to usersService.reactivate with the id param', async () => {
      const safeUser = {
        id: 'u1',
        name: 'Vendor One',
        email: 'vendor@example.com',
        role: 'VENDOR',
        isSuspended: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      };
      mockUsersService.reactivate.mockResolvedValue(safeUser);

      const result = await controller.reactivate('u1');

      expect(mockUsersService.reactivate).toHaveBeenCalledWith('u1');
      expect(result).toEqual(safeUser);
    });
  });
});
