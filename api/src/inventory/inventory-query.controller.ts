import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ListingsService } from './listings.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'generated/prisma/enums';

@Controller('inventory')
export class InventoryQueryController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(@Req() req: Request) {
    return this.listingsService.findPublished(req.user?.role);
  }

  @Get('upcoming')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENDOR)
  getUpcoming() {
    return this.listingsService.getUpcoming();
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.listingsService.findOnePublic(id, req.user?.role);
  }
}
