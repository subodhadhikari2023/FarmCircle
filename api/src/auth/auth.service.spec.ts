import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

jest.mock('argon2');
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(),
}));

const JWT_CONFIG: Record<string, string | number> = {
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_REFRESH_TTL_SECONDS: 604800,
};

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => JWT_CONFIG[key]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
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

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'vendor@example.com',
      password: 'plaintext-password',
    };

    const existingUser = {
      id: 'user-id',
      email: loginDto.email,
      name: 'Test Vendor',
      role: 'VENDOR',
      passwordHash: 'hashed-password',
    };

    it('throws UnauthorizedException when no user exists for the email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(argon2.verify).toHaveBeenCalledWith(
        existingUser.passwordHash,
        loginDto.password,
      );
    });

    it('signs an access token and a refresh token, and persists a hashed refresh token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockImplementation((input: string) =>
        Promise.resolve(`hashed:${input}`),
      );
      (crypto.randomUUID as jest.Mock).mockReturnValue(
        '11111111-1111-1111-1111-111111111111',
      );
      mockJwtService.sign.mockImplementation(
        (_payload: unknown, options: { secret: string }) =>
          options.secret === JWT_CONFIG.JWT_ACCESS_SECRET
            ? 'signed-access-token'
            : 'signed-refresh-token',
      );
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: existingUser.id, role: existingUser.role },
        {
          secret: JWT_CONFIG.JWT_ACCESS_SECRET,
          expiresIn: JWT_CONFIG.JWT_ACCESS_TTL_SECONDS,
        },
      );
      expect(mockJwtService.sign).toHaveBeenNthCalledWith(
        2,
        {
          sub: existingUser.id,
          jti: '11111111-1111-1111-1111-111111111111',
        },
        {
          secret: JWT_CONFIG.JWT_REFRESH_SECRET,
          expiresIn: JWT_CONFIG.JWT_REFRESH_TTL_SECONDS,
        },
      );
      expect(argon2.hash).toHaveBeenCalledWith('signed-refresh-token');
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalledWith({
        data: {
          id: '11111111-1111-1111-1111-111111111111',
          userId: existingUser.id,
          tokenHash: 'hashed:signed-refresh-token',
          expiresAt: expect.any(Date),
        },
      });
      expect(result).toEqual({
        accessToken: 'signed-access-token',
        refreshToken: 'signed-refresh-token',
      });
    });

    it('never leaks the refresh token payload without hashing it first', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      (crypto.randomUUID as jest.Mock).mockReturnValue(
        '22222222-2222-2222-2222-222222222222',
      );
      mockJwtService.sign.mockReturnValue('some-signed-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.login(loginDto);

      const [createArgs] = mockPrismaService.refreshToken.create.mock
        .calls[0] as [{ data: { tokenHash: string } }];
      expect(createArgs.data.tokenHash).toBe('hashed-refresh-token');
      expect(createArgs.data).not.toHaveProperty('refreshToken');
    });

    // Currently failing: OAuth-only users (passwordHash === null) fall through
    // the null-check in AuthService.login and get an undefined 200 response
    // instead of a 401. See auth.service.ts login().
    it('throws UnauthorizedException when the user has no password set (OAuth-only)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...existingUser,
        passwordHash: null,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
