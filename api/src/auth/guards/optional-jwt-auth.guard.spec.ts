import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  it('returns the user when authentication succeeds', () => {
    const user = { id: 'u1', role: 'VENDOR' };

    expect(guard.handleRequest(null, user)).toEqual(user);
  });

  it('returns undefined instead of throwing when there is no user', () => {
    expect(guard.handleRequest(null, false)).toBeUndefined();
  });

  it('returns undefined instead of throwing when authentication errors', () => {
    expect(
      guard.handleRequest(new Error('invalid token'), false),
    ).toBeUndefined();
  });
});
