import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from 'generated/prisma/enums';

export interface JwtAccessPayload {
  sub: string;
  role: Role;
}

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtAccessPayload): AuthenticatedUser {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Invalid access token payload');
    }
    return { id: payload.sub, role: payload.role };
  }
}
