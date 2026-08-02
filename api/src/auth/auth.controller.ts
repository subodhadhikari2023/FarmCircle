import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleCallbackAuthGuard } from './guards/google-callback-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// Read directly from process.env (not ConfigService) because @Throttle()'s
// argument must be a static value available at decorator-evaluation time,
// before Nest's DI container exists. Defaults to a strict production value;
// local/CI/e2e environments set AUTH_THROTTLE_LIMIT to something loose so
// the test suite's many rapid login/register calls aren't throttled.
const AUTH_THROTTLE_LIMIT = Number(process.env.AUTH_THROTTLE_LIMIT ?? 5);
const AUTH_THROTTLE_TTL_MS = 60_000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({
    default: { limit: AUTH_THROTTLE_LIMIT, ttl: AUTH_THROTTLE_TTL_MS },
  })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(dto);

    this.setRefreshCookie(res, refreshToken);

    return { accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string | undefined>;
    const refreshToken = cookies.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token cookie missing');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken);

    this.setRefreshCookie(res, newRefreshToken);

    return { accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cookies = req.cookies as Record<string, string | undefined>;
    await this.authService.logout(cookies.refreshToken);
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    });
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    // never runs: GoogleAuthGuard redirects to Google before the handler is reached
  }

  @Get('google/callback')
  @UseGuards(GoogleCallbackAuthGuard)
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    if (!req.user) {
      res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
      return;
    }

    const { accessToken, refreshToken } =
      await this.authService.loginWithGoogle(req.user);

    this.setRefreshCookie(res, refreshToken);

    res.redirect(`${frontendUrl}/auth/callback#accessToken=${accessToken}`);
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: Number(this.configService.get('JWT_REFRESH_TTL_SECONDS')) * 1000,
    });
  }
}
