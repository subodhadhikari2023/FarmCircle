import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

export type OAuthRole = 'VENDOR' | 'CUSTOMER';

const STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthStatePayload {
  role: OAuthRole;
  iat: number;
}

function sign(payloadB64: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');
}

export function signState(role: OAuthRole, secret: string): string {
  const payload: OAuthStatePayload = { role, iat: Date.now() };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export function verifyState(
  state: string,
  secret: string,
): { role: OAuthRole } {
  const parts = state.split('.');
  if (parts.length !== 2) {
    throw new UnauthorizedException('Invalid OAuth state');
  }
  const [payloadB64, signature] = parts;

  const expectedSignature = sign(payloadB64, secret);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (
    signatureBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    throw new UnauthorizedException('Invalid OAuth state');
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as OAuthStatePayload;
  } catch {
    throw new UnauthorizedException('Invalid OAuth state');
  }

  if (
    typeof payload.iat !== 'number' ||
    (payload.role !== 'VENDOR' && payload.role !== 'CUSTOMER')
  ) {
    throw new UnauthorizedException('Invalid OAuth state');
  }

  if (Date.now() - payload.iat > STATE_TTL_MS) {
    throw new UnauthorizedException('OAuth state expired');
  }

  return { role: payload.role };
}
