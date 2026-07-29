import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { verifyState } from '../utils/oauth-state';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const state = req.query.state;
      if (typeof state !== 'string') {
        throw new UnauthorizedException('Missing OAuth state');
      }
      const { role } = verifyState(
        state,
        this.configService.getOrThrow<string>('GOOGLE_OAUTH_STATE_SECRET'),
      );

      const email = profile.emails?.[0]?.value;
      if (!email) {
        throw new UnauthorizedException('Google account has no email');
      }

      const user = await this.authService.validateGoogleUser({
        googleId: profile.id,
        email,
        emailVerified: profile.emails?.[0]?.verified === true,
        name: profile.displayName,
        role,
      });

      done(null, user);
    } catch (err) {
      done(err as Error, false);
    }
  }
}
