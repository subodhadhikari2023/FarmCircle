import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from 'generated/prisma/enums';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: Request) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.usersService.findMe(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Req() req: Request, @Body() dto: UpdateUserDto) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.usersService.updateMe(req.user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  suspend(@Param('id') id: string) {
    return this.usersService.suspend(id);
  }

  @Patch(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  reactivate(@Param('id') id: string) {
    return this.usersService.reactivate(id);
  }
}
