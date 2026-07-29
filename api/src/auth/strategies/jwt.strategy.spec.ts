import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtAccessPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  const mockConfigService = {
    getOrThrow: jest.fn().mockReturnValue('access-secret'),
  };

  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService.getOrThrow.mockReturnValue('access-secret');
    strategy = new JwtStrategy(mockConfigService as unknown as ConfigService);
  });

  it('reads the access token secret from config', () => {
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
      'JWT_ACCESS_SECRET',
    );
  });

  describe('validate', () => {
    it('returns the id and role from a well-formed payload', () => {
      const result = strategy.validate({ sub: 'user-id', role: 'VENDOR' });

      expect(result).toEqual({ id: 'user-id', role: 'VENDOR' });
    });

    it('throws UnauthorizedException when sub is missing', () => {
      const payload = { sub: '', role: 'VENDOR' } as JwtAccessPayload;

      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when role is missing', () => {
      const payload = {
        sub: 'user-id',
        role: '',
      } as unknown as JwtAccessPayload;

      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
    });
  });
});
