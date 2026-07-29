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
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CropsService } from './crops.service';
import { VarietiesService } from './varieties.service';
import { CreateCropDto } from './dto/create-crop.dto';
import { UpdateCropDto } from './dto/update-crop.dto';
import { CreateVarietyDto } from './dto/create-variety.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'generated/prisma/enums';

@Controller('crops')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GROWER)
export class CropsController {
  constructor(
    private readonly cropsService: CropsService,
    private readonly varietiesService: VarietiesService,
  ) {}

  private requireUserId(req: Request): string {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return req.user.id;
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateCropDto) {
    return this.cropsService.create(this.requireUserId(req), dto);
  }

  @Get()
  findAll(@Req() req: Request) {
    return this.cropsService.findAll(this.requireUserId(req));
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.cropsService.findOne(this.requireUserId(req), id);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCropDto,
  ) {
    return this.cropsService.update(this.requireUserId(req), id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.cropsService.remove(this.requireUserId(req), id);
  }

  @Post(':id/varieties')
  createVariety(
    @Req() req: Request,
    @Param('id') cropId: string,
    @Body() dto: CreateVarietyDto,
  ) {
    return this.varietiesService.create(this.requireUserId(req), cropId, dto);
  }

  @Get(':id/varieties')
  findAllVarieties(@Req() req: Request, @Param('id') cropId: string) {
    return this.varietiesService.findAllByCrop(this.requireUserId(req), cropId);
  }
}
