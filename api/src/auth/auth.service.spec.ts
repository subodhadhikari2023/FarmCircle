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
// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- jest.requireActual is untyped (`any`); argon2 needs the real crypto exports alongside the mocked randomUUID
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
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
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
      isSuspended: false,
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() is typed `any` in @types/jest; no cast survives the no-unnecessary-type-assertion autofix
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

    it('throws UnauthorizedException when the account is suspended, even with a valid password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...existingUser,
        isSuspended: true,
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const refreshToken = 'incoming-refresh-token';
    const decodedPayload = {
      sub: 'user-id',
      jti: '11111111-1111-1111-1111-111111111111',
    };
    const existingUser = {
      id: 'user-id',
      email: 'vendor@example.com',
      name: 'Test Vendor',
      role: 'VENDOR',
      passwordHash: 'hashed-password',
      isSuspended: false,
    };
    const storedRefreshToken = {
      id: decodedPayload.jti,
      userId: existingUser.id,
      tokenHash: 'hashed-refresh-token',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: null as Date | null,
    };

    it('throws UnauthorizedException when the refresh token JWT is invalid or expired', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when no RefreshToken row exists for the jti', async () => {
      mockJwtService.verify.mockReturnValue(decodedPayload);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { id: decodedPayload.jti },
      });
    });

    it('throws UnauthorizedException when the stored RefreshToken row was already revoked (reuse detected)', async () => {
      mockJwtService.verify.mockReturnValue(decodedPayload);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        ...storedRefreshToken,
        revokedAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(argon2.verify).not.toHaveBeenCalled();
      expect(mockPrismaService.refreshToken.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the stored RefreshToken row is expired', async () => {
      mockJwtService.verify.mockReturnValue(decodedPayload);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        ...storedRefreshToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the token hash does not match the stored hash', async () => {
      mockJwtService.verify.mockReturnValue(decodedPayload);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(
        storedRefreshToken,
      );
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.refreshToken.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the user record no longer exists', async () => {
      mockJwtService.verify.mockReturnValue(decodedPayload);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(
        storedRefreshToken,
      );
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.refreshToken.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the account is suspended', async () => {
      mockJwtService.verify.mockReturnValue(decodedPayload);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(
        storedRefreshToken,
      );
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...existingUser,
        isSuspended: true,
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.refreshToken.update).not.toHaveBeenCalled();
    });

    it('rotates the refresh token: revokes the old row, signs new tokens, and persists a new hashed row', async () => {
      mockJwtService.verify.mockReturnValue(decodedPayload);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(
        storedRefreshToken,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockImplementation((input: string) =>
        Promise.resolve(`hashed:${input}`),
      );
      (crypto.randomUUID as jest.Mock).mockReturnValue(
        '22222222-2222-2222-2222-222222222222',
      );
      mockJwtService.sign.mockImplementation(
        (_payload: unknown, options: { secret: string }) =>
          options.secret === JWT_CONFIG.JWT_ACCESS_SECRET
            ? 'new-signed-access-token'
            : 'new-signed-refresh-token',
      );
      mockPrismaService.refreshToken.update.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh(refreshToken);

      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: decodedPayload.jti },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() is typed `any` in @types/jest; no cast survives the no-unnecessary-type-assertion autofix
          revokedAt: expect.any(Date),
        },
      });
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
          jti: '22222222-2222-2222-2222-222222222222',
        },
        {
          secret: JWT_CONFIG.JWT_REFRESH_SECRET,
          expiresIn: JWT_CONFIG.JWT_REFRESH_TTL_SECONDS,
        },
      );
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalledWith({
        data: {
          id: '22222222-2222-2222-2222-222222222222',
          userId: existingUser.id,
          tokenHash: 'hashed:new-signed-refresh-token',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() is typed `any` in @types/jest; no cast survives the no-unnecessary-type-assertion autofix
          expiresAt: expect.any(Date),
        },
      });
      expect(result).toEqual({
        accessToken: 'new-signed-access-token',
        refreshToken: 'new-signed-refresh-token',
      });
    });

    it('never leaks the new refresh token payload without hashing it first', async () => {
      mockJwtService.verify.mockReturnValue(decodedPayload);
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(
        storedRefreshToken,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-new-refresh-token');
      (crypto.randomUUID as jest.Mock).mockReturnValue(
        '33333333-3333-3333-3333-333333333333',
      );
      mockJwtService.sign.mockReturnValue('some-signed-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      await service.refresh(refreshToken);

      const [createArgs] = mockPrismaService.refreshToken.create.mock
        .calls[0] as [{ data: { tokenHash: string } }];
      expect(createArgs.data.tokenHash).toBe('hashed-new-refresh-token');
      expect(createArgs.data).not.toHaveProperty('refreshToken');
    });
  });

  describe('logout', () => {
    it('does nothing when no refresh token is given', async () => {
      await service.logout(undefined);

      expect(mockJwtService.verify).not.toHaveBeenCalled();
      expect(mockPrismaService.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('does nothing when the refresh token JWT is invalid or expired', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.logout('garbage-refresh-token'),
      ).resolves.toBeUndefined();
      expect(mockPrismaService.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('revokes the stored RefreshToken row matching the jti', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-id',
        jti: '11111111-1111-1111-1111-111111111111',
      });
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.logout('a-valid-refresh-token');

      expect(mockJwtService.verify).toHaveBeenCalledWith(
        'a-valid-refresh-token',
        { secret: JWT_CONFIG.JWT_REFRESH_SECRET },
      );
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          id: '11111111-1111-1111-1111-111111111111',
          revokedAt: null,
        },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() is typed `any` in @types/jest; no cast survives the no-unnecessary-type-assertion autofix
          revokedAt: expect.any(Date),
        },
      });
    });

    it('is idempotent when the token was already revoked', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-id',
        jti: '11111111-1111-1111-1111-111111111111',
      });
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.logout('an-already-revoked-refresh-token'),
      ).resolves.toBeUndefined();
    });
  });

  describe('validateGoogleUser', () => {
    const params = {
      googleId: 'google-id-1',
      email: 'vendor@example.com',
      emailVerified: true,
      name: 'Test Vendor',
      role: 'VENDOR' as const,
    };

    it('returns the existing user when found by googleId, ignoring the passed-in role', async () => {
      const existingUser = {
        id: 'user-id',
        email: params.email,
        name: params.name,
        role: 'CUSTOMER',
        isSuspended: false,
      };
      mockPrismaService.user.findUnique.mockResolvedValueOnce(existingUser);

      const result = await service.validateGoogleUser(params);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: params.googleId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isSuspended: true,
        },
      });
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(result).toEqual(existingUser);
    });

    it('throws UnauthorizedException when the account matched by googleId is suspended', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'user-id',
        email: params.email,
        name: params.name,
        role: 'CUSTOMER',
        isSuspended: true,
      });

      await expect(service.validateGoogleUser(params)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('links googleId to an existing verified-email account and returns it', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // by googleId
        .mockResolvedValueOnce({ id: 'existing-user-id', isSuspended: false }); // by email
      const updatedUser = {
        id: 'existing-user-id',
        email: params.email,
        name: params.name,
        role: 'CUSTOMER',
      };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.validateGoogleUser(params);

      expect(mockPrismaService.user.findUnique).toHaveBeenNthCalledWith(2, {
        where: { email: params.email },
        select: { id: true, isSuspended: true },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'existing-user-id' },
        data: { googleId: params.googleId },
        select: { id: true, email: true, name: true, role: true },
      });
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
      expect(result).toEqual(updatedUser);
    });

    it('throws UnauthorizedException instead of linking when the Google email is unverified', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // by googleId
        .mockResolvedValueOnce({ id: 'existing-user-id', isSuspended: false }); // by email

      await expect(
        service.validateGoogleUser({ ...params, emailVerified: false }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when linking to an existing account that is suspended', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // by googleId
        .mockResolvedValueOnce({ id: 'existing-user-id', isSuspended: true }); // by email

      await expect(service.validateGoogleUser(params)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('creates a new user with the role from the caller when no match exists', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // by googleId
        .mockResolvedValueOnce(null); // by email
      const createdUser = {
        id: 'new-user-id',
        email: params.email,
        name: params.name,
        role: params.role,
      };
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.validateGoogleUser(params);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: params.email,
          name: params.name,
          googleId: params.googleId,
          role: params.role,
        },
        select: { id: true, email: true, name: true, role: true },
      });
      expect(result).toEqual(createdUser);
    });
  });
});
