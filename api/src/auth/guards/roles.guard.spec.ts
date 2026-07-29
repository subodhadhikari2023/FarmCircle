import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(mockReflector as unknown as Reflector);
  });

  const buildContext = (user?: { id: string; role: string }) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }) as unknown as Request,
      }),
    }) as unknown as ExecutionContext;

  it('allows the request when no roles metadata is set on the route', () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    const result = guard.canActivate(
      buildContext({ id: 'u1', role: 'CUSTOMER' }),
    );

    expect(result).toBe(true);
  });

  it("allows the request when the user's role is in the required roles list", () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    const result = guard.canActivate(buildContext({ id: 'u1', role: 'ADMIN' }));

    expect(result).toBe(true);
  });

  it("denies the request when the user's role is not in the required roles list", () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    const result = guard.canActivate(
      buildContext({ id: 'u1', role: 'CUSTOMER' }),
    );

    expect(result).toBe(false);
  });

  it('denies the request when there is no authenticated user', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    const result = guard.canActivate(buildContext(undefined));

    expect(result).toBe(false);
  });
});
