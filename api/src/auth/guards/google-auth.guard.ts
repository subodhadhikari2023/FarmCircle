import {
  BadRequestException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { OAuthRole, signState } from '../utils/oauth-state';

function isOAuthRole(value: unknown): value is OAuthRole {
  return value === 'VENDOR' || value === 'CUSTOMER';
}

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const role = request.query.role;

    if (!isOAuthRole(role)) {
      throw new BadRequestException('role must be VENDOR or CUSTOMER');
    }

    const state = signState(
      role,
      this.configService.getOrThrow<string>('GOOGLE_OAUTH_STATE_SECRET'),
    );

    return { state, session: false };
  }
}
