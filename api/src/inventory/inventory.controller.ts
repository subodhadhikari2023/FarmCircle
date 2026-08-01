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
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { SetListingTermsDto } from './dto/set-listing-terms.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'generated/prisma/enums';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GROWER)
export class InventoryController {
  constructor(private readonly listingsService: ListingsService) {}

  private requireUserId(req: Request): string {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return req.user.id;
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateListingDto) {
    return this.listingsService.create(this.requireUserId(req), dto);
  }

  // Registered ahead of InventoryQueryController's GET /inventory/:id (see
  // InventoryModule's controllers order) so "mine" isn't swallowed as an id.
  @Get('mine')
  findMine(@Req() req: Request) {
    return this.listingsService.findMine(this.requireUserId(req));
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.update(this.requireUserId(req), id, dto);
  }

  @Patch(':id/close')
  close(@Req() req: Request, @Param('id') id: string) {
    return this.listingsService.close(this.requireUserId(req), id);
  }

  @Post('from-batch/:batchId')
  createDraftFromBatch(
    @Req() req: Request,
    @Param('batchId') batchId: string,
    @Body() dto: SetListingTermsDto,
  ) {
    return this.listingsService.createDraftFromBatch(
      this.requireUserId(req),
      batchId,
      dto,
    );
  }
}
