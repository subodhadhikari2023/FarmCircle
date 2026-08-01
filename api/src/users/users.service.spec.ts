import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    address: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findMe', () => {
    it("returns the user's profile without passwordHash or googleId", async () => {
      const safeUser = {
        id: 'u1',
        name: 'Ann',
        email: 'ann@example.com',
        role: 'CUSTOMER',
        isSuspended: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      };
      mockPrismaService.user.findUnique.mockResolvedValue(safeUser);

      const result = await service.findMe('u1');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isSuspended: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(safeUser);
    });
  });

  describe('updateMe', () => {
    it('updates the name field and returns the safe profile', async () => {
      const safeUser = {
        id: 'u1',
        name: 'Ann Updated',
        email: 'ann@example.com',
        role: 'CUSTOMER',
        isSuspended: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      };
      mockPrismaService.user.update.mockResolvedValue(safeUser);

      const result = await service.updateMe('u1', { name: 'Ann Updated' });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { name: 'Ann Updated' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isSuspended: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(safeUser);
    });
  });

  describe('listMyAddresses', () => {
    it("lists the user's own addresses, most recent first", async () => {
      const addresses = [
        {
          id: 'a1',
          userId: 'u1',
          addressText: '123 Farm Lane',
          landmark: null,
          latitude: 12.9,
          longitude: 77.6,
          createdAt: new Date('2026-01-02'),
        },
      ];
      mockPrismaService.address.findMany.mockResolvedValue(addresses);

      const result = await service.listMyAddresses('u1');

      expect(mockPrismaService.address.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(addresses);
    });
  });

  describe('createAddress', () => {
    it('creates an address owned by the authenticated user', async () => {
      const dto = {
        addressText: '123 Farm Lane',
        landmark: 'Near the water tower',
        latitude: 12.9,
        longitude: 77.6,
      };
      const address = { id: 'a1', userId: 'u1', ...dto };
      mockPrismaService.address.create.mockResolvedValue(address);

      const result = await service.createAddress('u1', dto);

      expect(mockPrismaService.address.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          addressText: dto.addressText,
          landmark: dto.landmark,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });
      expect(result).toEqual(address);
    });
  });

  describe('findAll', () => {
    it('lists only Vendor/Customer accounts as safe profiles', async () => {
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
        {
          id: 'u2',
          name: 'Customer One',
          email: 'customer@example.com',
          role: 'CUSTOMER',
          isSuspended: false,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(safeUsers);

      const result = await service.findAll();

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { role: { in: ['VENDOR', 'CUSTOMER'] } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isSuspended: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(safeUsers);
    });
  });

  describe('findOne', () => {
    const safeUser = {
      id: 'u1',
      name: 'Vendor One',
      email: 'vendor@example.com',
      role: 'VENDOR',
      isSuspended: false,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    it('returns the safe profile when the account exists and is a Vendor/Customer', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(safeUser);

      const result = await service.findOne('u1');

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'u1', role: { in: ['VENDOR', 'CUSTOMER'] } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isSuspended: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(safeUser);
    });

    it('throws NotFoundException when the account does not exist or is a Grower/Admin (excluded by the role filter)', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('suspend', () => {
    it('suspends an active account and returns the safe profile', async () => {
      const activeUser = { id: 'u1', isSuspended: false };
      const suspendedUser = {
        id: 'u1',
        name: 'Vendor One',
        email: 'vendor@example.com',
        role: 'VENDOR',
        isSuspended: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      };
      mockPrismaService.user.findFirst.mockResolvedValue(activeUser);
      mockPrismaService.user.update.mockResolvedValue(suspendedUser);

      const result = await service.suspend('u1');

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'u1', role: { in: ['VENDOR', 'CUSTOMER'] } },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isSuspended: true },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isSuspended: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(suspendedUser);
    });

    it('throws NotFoundException when the account does not exist or is a Grower/Admin', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.suspend('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the account is already suspended', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'u1',
        isSuspended: true,
      });

      await expect(service.suspend('u1')).rejects.toThrow(ConflictException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('reactivate', () => {
    it('reactivates a suspended account and returns the safe profile', async () => {
      const suspendedUser = { id: 'u1', isSuspended: true };
      const reactivatedUser = {
        id: 'u1',
        name: 'Vendor One',
        email: 'vendor@example.com',
        role: 'VENDOR',
        isSuspended: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      };
      mockPrismaService.user.findFirst.mockResolvedValue(suspendedUser);
      mockPrismaService.user.update.mockResolvedValue(reactivatedUser);

      const result = await service.reactivate('u1');

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'u1', role: { in: ['VENDOR', 'CUSTOMER'] } },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isSuspended: false },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isSuspended: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(reactivatedUser);
    });

    it('throws NotFoundException when the account does not exist or is a Grower/Admin', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.reactivate('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the account is not suspended', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'u1',
        isSuspended: false,
      });

      await expect(service.reactivate('u1')).rejects.toThrow(ConflictException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });
});
