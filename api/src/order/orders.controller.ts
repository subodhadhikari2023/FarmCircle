import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { DisputeOrderDto } from './dto/dispute-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'generated/prisma/enums';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private requireUser(req: Request) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return req.user;
  }

  @Post()
  @Roles(Role.VENDOR, Role.CUSTOMER)
  create(@Req() req: Request, @Body() dto: CreateOrderDto) {
    const user = this.requireUser(req);
    return this.ordersService.create(user.id, user.role, dto);
  }

  @Get()
  @Roles(Role.VENDOR, Role.CUSTOMER, Role.ADMIN)
  findAll(@Req() req: Request) {
    const user = this.requireUser(req);
    return this.ordersService.findAllForUser(user.id, user.role);
  }

  @Get(':id')
  @Roles(Role.VENDOR, Role.CUSTOMER, Role.ADMIN)
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = this.requireUser(req);
    return this.ordersService.findOne(user.id, user.role, id);
  }

  @Patch(':id/status')
  @Roles(Role.GROWER)
  advanceStatus(@Req() req: Request, @Param('id') id: string) {
    const user = this.requireUser(req);
    return this.ordersService.advanceStatus(user.id, id);
  }

  @Patch(':id/dispute')
  @Roles(Role.ADMIN)
  dispute(@Param('id') id: string, @Body() dto: DisputeOrderDto) {
    return this.ordersService.dispute(id, dto);
  }

  @Patch(':id/cancel')
  @Roles(Role.VENDOR, Role.CUSTOMER)
  cancel(@Req() req: Request, @Param('id') id: string) {
    const user = this.requireUser(req);
    return this.ordersService.cancel(user.id, id);
  }
}
