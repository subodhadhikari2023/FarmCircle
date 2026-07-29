import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { MilestonesService } from './milestones.service';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'generated/prisma/enums';

@Controller('milestones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GROWER)
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  private requireUserId(req: Request): string {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return req.user.id;
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.milestonesService.update(this.requireUserId(req), id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.milestonesService.remove(this.requireUserId(req), id);
  }
}
