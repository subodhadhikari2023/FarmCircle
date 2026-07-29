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
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { AdvanceMilestoneDto } from './dto/advance-milestone.dto';
import { ConfirmHarvestDto } from './dto/confirm-harvest.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'generated/prisma/enums';

@Controller('batches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GROWER)
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  private requireUserId(req: Request): string {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return req.user.id;
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateBatchDto) {
    return this.batchesService.create(this.requireUserId(req), dto);
  }

  @Get()
  findAll(@Req() req: Request) {
    return this.batchesService.findAll(this.requireUserId(req));
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.batchesService.findOne(this.requireUserId(req), id);
  }

  @Patch(':id/milestone')
  advanceMilestone(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AdvanceMilestoneDto,
  ) {
    return this.batchesService.advanceMilestone(
      this.requireUserId(req),
      id,
      dto,
    );
  }

  @Patch(':id/confirm-harvest')
  confirmHarvest(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ConfirmHarvestDto,
  ) {
    return this.batchesService.confirmHarvest(this.requireUserId(req), id, dto);
  }
}
