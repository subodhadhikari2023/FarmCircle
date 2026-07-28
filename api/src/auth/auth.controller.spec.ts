import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('604800'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('sets the refresh token as an httpOnly cookie and returns only the access token', async () => {
      const loginDto: LoginDto = {
        email: 'vendor@example.com',
        password: 'plaintext-password',
      };
      mockAuthService.login.mockResolvedValue({
        accessToken: 'signed-access-token',
        refreshToken: 'signed-refresh-token',
      });
      const cookieMock = jest.fn();
      const mockResponse = {
        cookie: cookieMock,
      } as unknown as Response;

      const result = await controller.login(loginDto, mockResponse);

      expect(cookieMock).toHaveBeenCalledWith(
        'refreshToken',
        'signed-refresh-token',
        {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 604800 * 1000,
        },
      );
      expect(result).toEqual({ accessToken: 'signed-access-token' });
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when no refreshToken cookie is present', async () => {
      const mockRequest = { cookies: {} } as unknown as Request;
      const mockResponse = { cookie: jest.fn() } as unknown as Response;

      await expect(
        controller.refresh(mockRequest, mockResponse),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });

    it('exchanges the refresh token cookie for a new access token and rotates the cookie', async () => {
      const mockRequest = {
        cookies: { refreshToken: 'incoming-refresh-token' },
      } as unknown as Request;
      const cookieMock = jest.fn();
      const mockResponse = { cookie: cookieMock } as unknown as Response;
      mockAuthService.refresh.mockResolvedValue({
        accessToken: 'new-signed-access-token',
        refreshToken: 'new-signed-refresh-token',
      });

      const result = await controller.refresh(mockRequest, mockResponse);

      expect(mockAuthService.refresh).toHaveBeenCalledWith(
        'incoming-refresh-token',
      );
      expect(cookieMock).toHaveBeenCalledWith(
        'refreshToken',
        'new-signed-refresh-token',
        {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          maxAge: 604800 * 1000,
        },
      );
      expect(result).toEqual({ accessToken: 'new-signed-access-token' });
    });
  });
});
