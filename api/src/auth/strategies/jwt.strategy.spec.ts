import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtAccessPayload } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

describe('JwtStrategy', () => {
  const mockConfigService = {
    getOrThrow: jest.fn().mockReturnValue('access-secret'),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService.getOrThrow.mockReturnValue('access-secret');
    strategy = new JwtStrategy(
      mockConfigService as unknown as ConfigService,
      mockPrismaService as unknown as PrismaService,
    );
  });

  it('reads the access token secret from config', () => {
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
      'JWT_ACCESS_SECRET',
    );
  });

  describe('validate', () => {
    it('returns the id and role from a well-formed payload for an active user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        role: 'VENDOR',
        isSuspended: false,
      });

      const result = await strategy.validate({
        sub: 'user-id',
        role: 'VENDOR',
      });

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        select: { id: true, role: true, isSuspended: true },
      });
      expect(result).toEqual({ id: 'user-id', role: 'VENDOR' });
    });

    it('returns the role from the database, not the (possibly stale) token payload', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        role: 'ADMIN',
        isSuspended: false,
      });

      const result = await strategy.validate({
        sub: 'user-id',
        role: 'VENDOR',
      });

      expect(result).toEqual({ id: 'user-id', role: 'ADMIN' });
    });

    it('throws UnauthorizedException when sub is missing', async () => {
      const payload = { sub: '', role: 'VENDOR' } as JwtAccessPayload;

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when role is missing', async () => {
      const payload = {
        sub: 'user-id',
        role: '',
      } as unknown as JwtAccessPayload;

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'user-id', role: 'VENDOR' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the user is suspended', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        role: 'VENDOR',
        isSuspended: true,
      });

      await expect(
        strategy.validate({ sub: 'user-id', role: 'VENDOR' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
