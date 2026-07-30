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
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'generated/prisma/enums';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  private requireUser(req: Request) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return req.user;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENDOR, Role.CUSTOMER)
  create(@Req() req: Request, @Body() dto: CreateReviewDto) {
    const user = this.requireUser(req);
    return this.reviewsService.create(user.id, dto);
  }

  @Get()
  findAll() {
    return this.reviewsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id/hide')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  hide(@Param('id') id: string) {
    return this.reviewsService.hide(id);
  }
}
