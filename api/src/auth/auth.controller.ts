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
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleCallbackAuthGuard } from './guards/google-callback-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
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
    res.clearCookie('refreshToken');
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
      sameSite: 'strict',
      maxAge: Number(this.configService.get('JWT_REFRESH_TTL_SECONDS')) * 1000,
    });
  }
}
