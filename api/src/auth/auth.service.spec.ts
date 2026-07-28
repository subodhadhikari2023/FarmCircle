import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'vendor@example.com',
      password: 'plaintext-password',
      name: 'Test Vendor',
      role: 'VENDOR',
    };

    it('throws ConflictException when a user with the email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-id',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password and creates the user with the correct data', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-id',
        email: registerDto.email,
        name: registerDto.name,
        role: registerDto.role,
      });

      const result = await service.register(registerDto);

      expect(argon2.hash).toHaveBeenCalledWith(registerDto.password);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          name: registerDto.name,
          passwordHash: 'hashed-password',
          role: registerDto.role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });
      expect(result).toEqual({
        id: 'new-id',
        email: registerDto.email,
        name: registerDto.name,
        role: registerDto.role,
      });
    });

    it('never asks Prisma to select passwordHash back out', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
      const create = mockPrismaService.user.create as jest.Mock<
        Promise<unknown>,
        [{ data: Record<string, unknown>; select: Record<string, boolean> }]
      >;
      create.mockResolvedValue({});

      await service.register(registerDto);

      const [createArgs] = create.mock.calls[0];
      expect(createArgs.select).not.toHaveProperty('passwordHash');
    });
  });
});
