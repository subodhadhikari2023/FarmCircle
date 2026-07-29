import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { signState, verifyState } from './oauth-state';

const SECRET = 'test-state-secret';

function forgeState(payload: unknown, secret: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

describe('oauth-state', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('round trip', () => {
    it('verifies a state signed for VENDOR and returns that role', () => {
      const state = signState('VENDOR', SECRET);

      expect(verifyState(state, SECRET)).toEqual({ role: 'VENDOR' });
    });

    it('verifies a state signed for CUSTOMER and returns that role', () => {
      const state = signState('CUSTOMER', SECRET);

      expect(verifyState(state, SECRET)).toEqual({ role: 'CUSTOMER' });
    });

    it('still verifies just under the 10-minute expiry window', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const state = signState('VENDOR', SECRET);

      jest.setSystemTime(new Date('2026-01-01T00:09:59.000Z'));

      expect(verifyState(state, SECRET)).toEqual({ role: 'VENDOR' });
    });
  });

  describe('tampering', () => {
    it('rejects a state with a flipped signature character', () => {
      const state = signState('VENDOR', SECRET);
      const [payloadB64, signature] = state.split('.');
      const flipped =
        signature.slice(0, -1) + (signature.at(-1) === 'a' ? 'b' : 'a');
      const tampered = `${payloadB64}.${flipped}`;

      expect(() => verifyState(tampered, SECRET)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a state whose payload was changed without re-signing', () => {
      const state = signState('VENDOR', SECRET);
      const [, signature] = state.split('.');
      const swappedPayload = Buffer.from(
        JSON.stringify({ role: 'CUSTOMER', iat: Date.now() }),
      ).toString('base64url');
      const tampered = `${swappedPayload}.${signature}`;

      expect(() => verifyState(tampered, SECRET)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a state signed with a different secret', () => {
      const state = signState('VENDOR', 'a-different-secret');

      expect(() => verifyState(state, SECRET)).toThrow(UnauthorizedException);
    });

    it('rejects a state that is not in the payload.signature shape', () => {
      expect(() => verifyState('not-a-valid-state', SECRET)).toThrow(
        UnauthorizedException,
      );
      expect(() => verifyState('too.many.parts', SECRET)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a validly-signed payload that is not valid JSON', () => {
      const payloadB64 = Buffer.from('not json').toString('base64url');
      const signature = crypto
        .createHmac('sha256', SECRET)
        .update(payloadB64)
        .digest('base64url');
      const forged = `${payloadB64}.${signature}`;

      expect(() => verifyState(forged, SECRET)).toThrow(UnauthorizedException);
    });

    it('rejects a validly-signed payload carrying a role outside VENDOR/CUSTOMER', () => {
      const forged = forgeState({ role: 'ADMIN', iat: Date.now() }, SECRET);

      expect(() => verifyState(forged, SECRET)).toThrow(UnauthorizedException);
    });

    it('rejects a validly-signed payload missing iat', () => {
      const forged = forgeState({ role: 'VENDOR' }, SECRET);

      expect(() => verifyState(forged, SECRET)).toThrow(UnauthorizedException);
    });
  });

  describe('expiry', () => {
    it('rejects a state older than the 10-minute window', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const state = signState('VENDOR', SECRET);

      jest.setSystemTime(new Date('2026-01-01T00:10:01.000Z'));

      expect(() => verifyState(state, SECRET)).toThrow(
        new UnauthorizedException('OAuth state expired'),
      );
    });
  });
});
