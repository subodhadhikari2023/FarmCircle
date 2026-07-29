import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CyclesService } from './cycles.service';
import { MilestonesService } from './milestones.service';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'generated/prisma/enums';

@Controller('cycles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GROWER)
export class CyclesController {
  constructor(
    private readonly cyclesService: CyclesService,
    private readonly milestonesService: MilestonesService,
  ) {}

  private requireUserId(req: Request): string {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return req.user.id;
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateCycleDto) {
    return this.cyclesService.create(this.requireUserId(req), dto);
  }

  @Get()
  findAll(@Req() req: Request, @Query('cropId') cropId?: string) {
    return this.cyclesService.findAll(this.requireUserId(req), cropId);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.cyclesService.findOne(this.requireUserId(req), id);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCycleDto,
  ) {
    return this.cyclesService.update(this.requireUserId(req), id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.cyclesService.remove(this.requireUserId(req), id);
  }

  @Post(':id/milestones')
  createMilestone(
    @Req() req: Request,
    @Param('id') cycleId: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.milestonesService.create(this.requireUserId(req), cycleId, dto);
  }
}
