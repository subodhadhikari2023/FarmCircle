import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
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
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(dto);

    this.setRefreshCookie(res, refreshToken);

    return { accessToken };
  }

  @Post('refresh')
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

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    // never runs: GoogleAuthGuard redirects to Google before the handler is reached
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!req.user) {
      throw new UnauthorizedException('Google authentication failed');
    }

    const { accessToken, refreshToken } =
      await this.authService.loginWithGoogle(req.user);

    this.setRefreshCookie(res, refreshToken);

    return { accessToken };
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
