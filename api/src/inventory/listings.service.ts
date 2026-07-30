import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { Role } from 'generated/prisma/enums';
import type { Listing } from 'generated/prisma/client';
import {
  ListingContent,
  ListingContentDocument,
} from './schemas/listing-content.schema';

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(ListingContent.name)
    private readonly contentModel: Model<ListingContentDocument>,
  ) {}

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

    const listing = await this.prisma.listing.create({
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

    const content = await this.contentModel.create({
      listingId: listing.id,
      description: dto.description,
      images: dto.images ?? [],
      isOrganicCertified: dto.isOrganicCertified ?? false,
      attributes: dto.attributes,
    });

    return this.mergeContent(listing, content);
  }

  async findPublished(role?: Role) {
    const listings = await this.prisma.listing.findMany({
      where: { isPublished: true, isClosed: false },
    });
    const contentByListingId = await this.getContentMap(
      listings.map((listing) => listing.id),
    );
    return listings.map((listing) =>
      this.applyVisibility(
        this.mergeContent(listing, contentByListingId.get(listing.id) ?? null),
        role,
      ),
    );
  }

  async findOnePublic(id: string, role?: Role) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, isPublished: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    const content = await this.contentModel.findOne({ listingId: id });
    return this.applyVisibility(this.mergeContent(listing, content), role);
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
    const listing = await this.prisma.listing.update({
      where: { id },
      data: { availableQuantity: dto.availableQuantity },
    });

    const hasContentUpdate =
      dto.description !== undefined ||
      dto.images !== undefined ||
      dto.isOrganicCertified !== undefined ||
      dto.attributes !== undefined;

    const content = hasContentUpdate
      ? await this.contentModel.findOneAndUpdate(
          { listingId: id },
          {
            $set: {
              ...(dto.description !== undefined && {
                description: dto.description,
              }),
              ...(dto.images !== undefined && { images: dto.images }),
              ...(dto.isOrganicCertified !== undefined && {
                isOrganicCertified: dto.isOrganicCertified,
              }),
              ...(dto.attributes !== undefined && {
                attributes: dto.attributes,
              }),
            },
          },
          { upsert: true, returnDocument: 'after' },
        )
      : await this.contentModel.findOne({ listingId: id });

    return this.mergeContent(listing, content);
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

  private async getContentMap(listingIds: string[]) {
    if (listingIds.length === 0) {
      return new Map<string, ListingContentDocument>();
    }
    const contents = await this.contentModel.find({
      listingId: { $in: listingIds },
    });
    return new Map(contents.map((content) => [content.listingId, content]));
  }

  private mergeContent(
    listing: Listing,
    content: ListingContentDocument | null,
  ) {
    return {
      ...listing,
      description: content?.description,
      images: content?.images ?? [],
      isOrganicCertified: content?.isOrganicCertified ?? false,
      attributes: content?.attributes,
    };
  }

  private applyVisibility(listing: Record<string, unknown>, role?: Role) {
    if (role === Role.VENDOR) {
      return listing;
    }
    const rest = { ...listing };
    delete rest.wholesalePrice;
    delete rest.minWholesaleQty;
    return rest;
  }
}
