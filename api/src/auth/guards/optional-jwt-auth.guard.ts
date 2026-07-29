import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser | false): TUser {
    return (user || undefined) as TUser;
  }
}
