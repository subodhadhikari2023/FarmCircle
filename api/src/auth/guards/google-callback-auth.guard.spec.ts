import { GoogleCallbackAuthGuard } from './google-callback-auth.guard';

describe('GoogleCallbackAuthGuard', () => {
  const guard = new GoogleCallbackAuthGuard();

  it('returns the user on success', () => {
    const user = { id: 'u1', email: 'a@b.com', name: 'A', role: 'CUSTOMER' };
    expect(guard.handleRequest(null, user)).toBe(user);
  });

  it('returns null instead of throwing when passport reports no user', () => {
    expect(guard.handleRequest(null, false)).toBeNull();
  });

  it('returns null instead of throwing when passport reports an error', () => {
    expect(
      guard.handleRequest(new Error('oauth exchange failed'), false),
    ).toBeNull();
  });
});
