import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * The default AuthGuard throws (and Nest renders a raw JSON error page) when
 * the user cancels Google consent or the OAuth exchange fails. That leaves
 * the browser stranded outside the app. Swallowing the failure here instead
 * of throwing lets the controller handle it by redirecting back to the
 * frontend, same as every other outcome of this flow.
 */
@Injectable()
export class GoogleCallbackAuthGuard extends AuthGuard('google') {
  handleRequest<TUser = Express.User>(
    _err: unknown,
    user: TUser | false,
  ): TUser | null {
    return user || null;
  }
}
