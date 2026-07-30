import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PreBookingsService } from './prebookings.service';
import { CreatePreBookingDto } from './dto/create-prebooking.dto';
import { VerifyPaymentDto } from '../payment/dto/verify-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'generated/prisma/enums';

@Controller('prebookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PreBookingsController {
  constructor(private readonly preBookingsService: PreBookingsService) {}

  private requireUser(req: Request) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return req.user;
  }

  @Post()
  @Roles(Role.VENDOR)
  create(@Req() req: Request, @Body() dto: CreatePreBookingDto) {
    const user = this.requireUser(req);
    return this.preBookingsService.create(user.id, dto);
  }

  @Get()
  @Roles(Role.VENDOR, Role.ADMIN)
  findAll(@Req() req: Request) {
    const user = this.requireUser(req);
    return this.preBookingsService.findAllForUser(user.id, user.role);
  }

  @Get(':id')
  @Roles(Role.VENDOR, Role.ADMIN)
  findOne(@Req() req: Request, @Param('id') id: string) {
    const user = this.requireUser(req);
    return this.preBookingsService.findOne(user.id, user.role, id);
  }

  @Patch(':id/cancel')
  @Roles(Role.VENDOR)
  cancel(@Req() req: Request, @Param('id') id: string) {
    const user = this.requireUser(req);
    return this.preBookingsService.cancel(user.id, id);
  }

  @Get(':id/payment-intent')
  @Roles(Role.VENDOR)
  createPaymentIntent(@Req() req: Request, @Param('id') id: string) {
    const user = this.requireUser(req);
    return this.preBookingsService.createPaymentIntent(user.id, id);
  }

  @Post(':id/verify-payment')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.VENDOR)
  verifyPayment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    const user = this.requireUser(req);
    return this.preBookingsService.verifyPayment(user.id, id, dto);
  }
}
