import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { Role } from 'generated/prisma/enums';
import type { Listing } from 'generated/prisma/client';

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateListingDto) {
    const crop = await this.prisma.crop.findFirst({
      where: { id: dto.cropId, ownerId: userId },
    });
    if (!crop) {
      throw new NotFoundException('Crop not found');
    }

    const variety = await this.prisma.variety.findFirst({
      where: { id: dto.varietyId, cropId: dto.cropId },
    });
    if (!variety) {
      throw new NotFoundException('Variety not found for this crop');
    }

    return this.prisma.listing.create({
      data: {
        ownerId: userId,
        cropId: dto.cropId,
        varietyId: dto.varietyId,
        batchId: null,
        hasTrackedCycle: false,
        retailPrice: dto.retailPrice,
        wholesalePrice: dto.wholesalePrice,
        minWholesaleQty: dto.minWholesaleQty,
        retailCeilingPercent: dto.retailCeilingPercent,
        preBookablePercent: dto.preBookablePercent,
        availableQuantity: dto.availableQuantity,
        isPublished: true,
      },
    });
  }

  async findPublished(role?: Role) {
    const listings = await this.prisma.listing.findMany({
      where: { isPublished: true, isClosed: false },
    });
    return listings.map((listing) => this.applyVisibility(listing, role));
  }

  async findOnePublic(id: string, role?: Role) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, isPublished: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return this.applyVisibility(listing, role);
  }

  getUpcoming() {
    return this.prisma.batch.findMany({
      where: { harvestConfirmed: false },
      include: { crop: true, variety: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateListingDto) {
    await this.findOwned(userId, id);
    return this.prisma.listing.update({
      where: { id },
      data: { availableQuantity: dto.availableQuantity },
    });
  }

  async close(userId: string, id: string) {
    const listing = await this.findOwned(userId, id);
    if (listing.isClosed) {
      throw new ConflictException('Listing is already closed');
    }

    return this.prisma.listing.update({
      where: { id },
      data: { isClosed: true },
    });
  }

  private async findOwned(userId: string, id: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, ownerId: userId },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return listing;
  }

  private applyVisibility(listing: Listing, role?: Role) {
    if (role === Role.VENDOR) {
      return listing;
    }
    const rest: Partial<Listing> = { ...listing };
    delete rest.wholesalePrice;
    delete rest.minWholesaleQty;
    return rest;
  }
}
